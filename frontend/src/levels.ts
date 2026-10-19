export type OrgLevel = 'hq' | 'large' | 'middle' | 'small';

export const levelCode: Record<OrgLevel, string> = {
  hq: 'HQ',
  large: 'BL',
  middle: 'ML',
  small: 'SL',
};

export const childCode: Partial<Record<OrgLevel, string>> = {
  hq: 'BL',
  large: 'ML',
  middle: 'SL',
};
