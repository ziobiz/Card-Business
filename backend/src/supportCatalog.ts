/**
 * Wirex Partner Support Portal 가이드(2026) ↔ Corporate API 가능 범위.
 * Retail Support Portal(User ID 검색)과 Corporate API는 다른 제품이다.
 */

export type SupportCapability = {
  id: string;
  section: 'verification' | 'cards' | 'statements' | 'ticket';
  portal: string;
  status: 'api' | 'partial' | 'portal_only' | 'local';
  note: string;
};

export const SUPPORT_CAPABILITIES: SupportCapability[] = [
  {
    id: 'verif-status',
    section: 'verification',
    portal: 'Verification status / rejection reasons / missing documents',
    status: 'partial',
    note: 'Corporate는 개인 KYC가 아니라 법인 KYB다. GET /api/v1/corporations 의 verification_levels 로 조회. 문서 제출은 SumSub SDK만 가능.',
  },
  {
    id: 'verif-link',
    section: 'verification',
    portal: 'Generate verification link',
    status: 'partial',
    note: 'POST /api/v1/corporations/level-token 으로 SumSub SDK 토큰 발급(Su). 포털의 “업로드 링크”와 형태가 다르다.',
  },
  {
    id: 'verif-upload',
    section: 'verification',
    portal: 'Upload Proof of Address on behalf of user',
    status: 'portal_only',
    note: 'Corporate API로 문서 업로드 경로 없음. Support Portal / Wirex 개입 필요.',
  },
  {
    id: 'verif-recheck',
    section: 'verification',
    portal: 'Request re-check',
    status: 'portal_only',
    note: 'Rejected 레벨 재심은 Wirex 개입. API로 재시작 불가.',
  },
  {
    id: 'verif-template',
    section: 'verification',
    portal: 'Ready-made response template',
    status: 'local',
    note: '파트너 응대 문안은 우리 콘솔에 템플릿으로 둔다. Wirex API 호출 없음.',
  },
  {
    id: 'cards-profile',
    section: 'cards',
    portal: 'Personal data, cards, transactions',
    status: 'partial',
    note: '직원·카드 목록은 Corporate employees/cards API. 키·법인 토큰 필요. 지금은 로컬 조직 데이터로 조회.',
  },
  {
    id: 'cards-limits',
    section: 'cards',
    portal: 'Lower card limits / block / close',
    status: 'api',
    note: 'Managing a Card: block, unblock, close, re-limit. 법인 토큰 필요.',
  },
  {
    id: 'cards-phone',
    section: 'cards',
    portal: 'Change phone number',
    status: 'partial',
    note: '직원 프로필 갱신 API가 열려 있으면 가능. Support Portal Change 버튼과는 별개.',
  },
  {
    id: 'cards-chargeback',
    section: 'cards',
    portal: 'Check reversals / Initiate chargeback',
    status: 'portal_only',
    note: '차지백 개시는 Support Portal 전용. Corporate 카드 문서에 개시 API 없음.',
  },
  {
    id: 'cards-offboard',
    section: 'cards',
    portal: 'Offboard user (OTP)',
    status: 'portal_only',
    note: 'Offboard + OTP는 Support Portal 계정 액션. Corporate API 범위 밖.',
  },
  {
    id: 'stmt-generate',
    section: 'statements',
    portal: 'Generate statement by period and chain',
    status: 'api',
    note: 'POST /api/v1/activity/statement/full (최대 6개월, JSON). 체인별 법인 토큰 필요.',
  },
  {
    id: 'ticket',
    section: 'ticket',
    portal: 'Create support ticket from portal',
    status: 'portal_only',
    note: 'Wirex Support Portal 티켓. 우리 콘솔에서는 에스컬레이션 체크리스트만 제공.',
  },
];

export const VERIFICATION_TEMPLATES = {
  ko: {
    title: '검증 안내 (법인 KYB)',
    body: `안녕하세요.

법인 카드(Corporate) 검증은 개인 KYC가 아니라 회사 KYB입니다.
SumSub 화면에서 요청된 서류를 제출해 주세요.

- 통과한 레벨만 기능이 열립니다 (예: SDD Approved).
- Rejected 인 경우 Wirex 측 확인이 필요합니다. API로 재시작은 불가합니다.
- 주소지 증명 등 문서 대리 업로드는 Support Portal에서만 가능합니다.

문의 주시면 상태( verification_levels )를 확인해 드리겠습니다.`,
  },
  en: {
    title: 'Verification notice (Corporate KYB)',
    body: `Hello,

Corporate card verification is company KYB, not personal KYC.
Please submit the requested documents in the SumSub session.

- Only Approved levels unlock capabilities (for example SDD).
- If a level is Rejected, Wirex intervention is required; the API cannot restart it.
- Uploading proof-of-address on the user's behalf is Support Portal only.

Share your corporation status and we will check verification_levels.`,
  },
};

export const ESCALATION_CHECKLIST = [
  'User / employee / corporation ID',
  'What the user sees (screenshot if possible)',
  'Card last4 / card id (if card issue)',
  'Transaction id / time / amount (if payment issue)',
  'Already tried in Support Portal? ticket id',
];
