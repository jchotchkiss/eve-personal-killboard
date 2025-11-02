export const factionThemes = {
  // Empire Factions
  amarr: {
    primary: '#FBC345',
    secondary: '#FFD700',
    background: '#120A00',
    accent: '#F2FF00',
    text: '#FFD700'
  },
  caldari: {
    primary: '#5E7294',
    secondary: '#3680EE',
    background: '#001926',
    accent: '#00E8FF',
    text: '#FFFFFF'
  },
  gallente: {
    primary: '#12E700',
    secondary: '#FFFFFF',
    background: '#011200',
    accent: '#00FF30',
    text: '#FFFFFF'
  },
  minmatar: {
    primary: '#FF3800',
    secondary: '#AB2500',
    background: '#0E0700',
    accent: '#FF5C00',
    text: '#FFFFFF'
  },
  
  // Pirate Factions
  guristas: {
    primary: '#8E5F21',
    secondary: '#FF9100',
    background: '#261500',
    accent: '#FF5C00',
    text: '#FF9100'
  },
  angel: {
    primary: '#FF4D00',
    secondary: '#AB5200',
    background: '#26110E',
    accent: '#FF0000',
    text: '#FF4D00'
  },
  blood: {
    primary: '#800000',
    secondary: '#BE0000',
    background: '#260505',
    accent: '#FF0000',
    text: '#BE0000'
  },
  serpentis: {
    primary: '#BBC400',
    secondary: '#807E00',
    background: '#060A0C',
    accent: '#BBC400',
    text: '#BBC400'
  },
  sansha: {
    primary: '#218000',
    secondary: '#808080',
    background: '#000000',
    accent: '#00FF21',
    text: '#00FF21'
  }
};

export type ThemeName = keyof typeof factionThemes;