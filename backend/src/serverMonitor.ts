import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPlatform, type PlatformSettings } from './platformStore.js';

export type HealthLevel = 'ok' | 'warn' | 'danger' | 'unknown';

export type HealthRow = {
  key: string;
  label: string;
  value: string;
  level: HealthLevel;
};

function pct(used: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.round((used / total) * 1000) / 10;
}

function mb(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function gb(bytes: number) {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}

function readDisk() {
  const root = process.platform === 'win32' ? path.parse(process.cwd()).root : '/';
  try {
    const statfs = (fs as typeof fs & { statfsSync?: (p: string) => { bsize: number; blocks: number; bavail: number } }).statfsSync;
    if (typeof statfs === 'function') {
      const s = statfs(root);
      const total = s.bsize * s.blocks;
      const free = s.bsize * s.bavail;
      const used = total - free;
      return { pathRoot: root, totalBytes: total, freeBytes: free, usedBytes: used, usedPct: pct(used, total) };
    }
  } catch {
    /* ignore */
  }
  return { pathRoot: root, totalBytes: 0, freeBytes: 0, usedBytes: 0, usedPct: 0 };
}

function readSsl(settings: PlatformSettings) {
  const out: Record<string, unknown> = {
    status: 'missing',
    subject: '',
    issuer: '',
    notBefore: '',
    notAfter: '',
    daysRemaining: null as number | null,
    fingerprintSha256: '',
    sanDnsNames: [] as string[],
    certPath: settings.sslCertPath || '',
    leDomain: settings.sslLeDomain || '',
  };
  const certPath = (settings.sslCertPath || '').trim();
  if (!certPath) {
    out.status = 'not_configured';
    return out;
  }
  try {
    if (!fs.existsSync(certPath)) {
      out.status = 'file_missing';
      return out;
    }
    const pem = fs.readFileSync(certPath);
    const cert = new X509Certificate(pem);
    const notAfter = new Date(cert.validTo);
    const notBefore = new Date(cert.validFrom);
    const days = Math.ceil((notAfter.getTime() - Date.now()) / (24 * 3600 * 1000));
    out.status = days <= 0 ? 'expired' : days <= 14 ? 'danger' : days <= 30 ? 'warn' : 'ok';
    out.subject = cert.subject;
    out.issuer = cert.issuer;
    out.notBefore = notBefore.toISOString();
    out.notAfter = notAfter.toISOString();
    out.daysRemaining = days;
    out.fingerprintSha256 = cert.fingerprint256;
    const san = cert.subjectAltName || '';
    out.sanDnsNames = san
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.toLowerCase().startsWith('dns:'))
      .map((part) => part.slice(4).trim());
  } catch (e) {
    out.status = 'read_error';
    out.error = e instanceof Error ? e.message : 'ssl_read_failed';
  }
  return out;
}

function levelMem(p: number): HealthLevel {
  if (p >= 90) return 'danger';
  if (p >= 70) return 'warn';
  return 'ok';
}

function levelDisk(p: number): HealthLevel {
  if (p >= 90) return 'danger';
  if (p >= 75) return 'warn';
  return 'ok';
}

function levelSsl(days: number | null, status: string): HealthLevel {
  if (status === 'not_configured') return 'unknown';
  if (status === 'expired' || status === 'file_missing' || status === 'read_error') return 'danger';
  if (days == null) return 'unknown';
  if (days <= 14) return 'danger';
  if (days <= 30) return 'warn';
  return 'ok';
}

export function buildServerSummary() {
  const settings = readPlatform();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = pct(usedMem, totalMem);
  const heap = process.memoryUsage();
  const heapPct = pct(heap.heapUsed, heap.heapTotal || 1);
  const disk = readDisk();
  const ssl = readSsl(settings);
  const load = os.loadavg()?.[0] ?? 0;
  const cpus = os.cpus()?.length || 1;
  const uptimeMs = Math.round(process.uptime() * 1000);

  const contractDiskMb = Math.round((settings.contractDiskGb || 0) * 1024);
  const contractTrafficMb = Math.round((settings.contractTrafficGb || 0) * 1024);
  const trafficUsedMb = Math.round((settings.contractTrafficUsedGb || 0) * 1024);
  const diskUsedMb = mb(disk.usedBytes);
  const contractDiskPct = contractDiskMb > 0 ? pct(diskUsedMb, contractDiskMb) : 0;
  const contractTrafficPct = contractTrafficMb > 0 ? pct(trafficUsedMb, contractTrafficMb) : 0;

  let contractDaysLeft: number | null = null;
  if (settings.contractEnd) {
    const end = new Date(settings.contractEnd);
    if (!Number.isNaN(end.getTime())) {
      contractDaysLeft = Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000));
    }
  }

  const health: HealthRow[] = [
    { key: 'sysMem', label: '시스템 메모리', value: `${memPct}% (${mb(usedMem)} / ${mb(totalMem)} MB)`, level: levelMem(memPct) },
    { key: 'jvmHeap', label: '프로세스 힙', value: `${heapPct}% (${mb(heap.heapUsed)} / ${mb(heap.heapTotal)} MB)`, level: levelMem(heapPct) },
    { key: 'loadAvg', label: '로드 평균', value: `${load.toFixed(2)} / ${cpus} CPU`, level: load > cpus * 2 ? 'danger' : load > cpus ? 'warn' : 'ok' },
    {
      key: 'disk',
      label: '디스크',
      value: disk.totalBytes ? `${disk.usedPct}% (${gb(disk.usedBytes)} / ${gb(disk.totalBytes)} GB)` : '조회 불가',
      level: disk.totalBytes ? levelDisk(disk.usedPct) : 'unknown',
    },
    {
      key: 'ssl',
      label: 'SSL 인증서',
      value:
        ssl.daysRemaining != null
          ? `${ssl.status} · ${ssl.daysRemaining}일 남음`
          : String(ssl.status),
      level: levelSsl(ssl.daysRemaining as number | null, String(ssl.status)),
    },
    {
      key: 'contractDisk',
      label: '약정 디스크',
      value: contractDiskMb > 0 ? `${contractDiskPct}% (${diskUsedMb} / ${contractDiskMb} MB)` : '미설정',
      level: contractDiskMb > 0 ? levelDisk(contractDiskPct) : 'unknown',
    },
    {
      key: 'contractTraffic',
      label: '약정 트래픽',
      value: contractTrafficMb > 0 ? `${contractTrafficPct}% (${trafficUsedMb} / ${contractTrafficMb} MB)` : '미설정',
      level: contractTrafficMb > 0 ? levelDisk(contractTrafficPct) : 'unknown',
    },
    {
      key: 'hostingEnd',
      label: '호스팅 약정 종료',
      value: settings.contractEnd
        ? `${settings.contractEnd}${contractDaysLeft != null ? ` · ${contractDaysLeft}일` : ''}`
        : '미설정',
      level:
        contractDaysLeft == null ? 'unknown'
          : contractDaysLeft <= 0 ? 'danger'
            : contractDaysLeft <= 30 ? 'warn'
              : 'ok',
    },
  ];

  const alerts = health
    .filter((row) => row.level === 'danger' || row.level === 'warn')
    .map((row) => ({ level: row.level, key: row.key, message: `${row.label}: ${row.value}` }));

  return {
    generatedAt: new Date().toISOString(),
    uiRefreshSec: settings.uiRefreshSec,
    settings: {
      publicHost: settings.publicHost,
      publicApiBase: settings.publicApiBase,
      sslCertPath: settings.sslCertPath,
      sslLeDomain: settings.sslLeDomain,
      uiRefreshSec: settings.uiRefreshSec,
      contractDiskGb: settings.contractDiskGb,
      contractTrafficGb: settings.contractTrafficGb,
      contractTrafficUsedGb: settings.contractTrafficUsedGb,
      contractStart: settings.contractStart,
      contractEnd: settings.contractEnd,
      note: settings.note,
    },
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpuCount: cpus,
      cpuModel: os.cpus()?.[0]?.model || '',
      memoryTotalMb: mb(totalMem),
      memoryAvailableMb: mb(freeMem),
      memoryUsedPct: memPct,
      uptimeSec: os.uptime(),
    },
    process: {
      nodeVersion: process.version,
      pid: process.pid,
      uptimeMs,
      heapUsedMb: mb(heap.heapUsed),
      heapTotalMb: mb(heap.heapTotal),
      heapUsedPct: heapPct,
      rssMb: mb(heap.rss),
      loadAverage: load,
    },
    disk,
    ssl,
    contract: {
      diskGb: settings.contractDiskGb,
      trafficGb: settings.contractTrafficGb,
      trafficUsedGb: settings.contractTrafficUsedGb,
      start: settings.contractStart,
      end: settings.contractEnd,
      daysLeft: contractDaysLeft,
      diskUsedPct: contractDiskPct,
      trafficUsedPct: contractTrafficPct,
    },
    health,
    alerts,
  };
}
