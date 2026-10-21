import { useEffect } from 'react';
import { API } from './api';

export type BrandView = {
  brandName?: string;
  logoUrl?: string;
  loginLogoUrl?: string;
  loginBackgroundUrl?: string;
  faviconUrl?: string;
  siteName?: string;
  footerText?: string;
  accentColor?: string;
};

export function assetUrl(value?: string) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${API}${value}`;
}

export function useDocumentBrand(brand: BrandView | null) {
  useEffect(() => {
    if (!brand) return;
    document.title = brand.siteName || brand.brandName || 'ICOCARD';
    const href = assetUrl(brand.faviconUrl);
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!href) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }, [brand]);
}
