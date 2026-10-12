// Semantic colors are shared by both themes. Distances in the catalog are demo data.
export const palette = {
  light: {
    background: "#F7F8F5",
    surface: "#FFFFFF",
    color: "#121512",
    muted: "#61685F",
    primary: "#172E25",
    primaryPress: "#294B3A",
    onPrimary: "#FFFFFF",
    border: "#DFE3DB",
    controlBorder: "#82907E",
    success: "#EDF2E9",
    successText: "#245831",
    warning: "#FFF0CC",
    warningText: "#6C4800",
    error: "#FCE8E6",
    errorText: "#9C2924",
    disabled: "#E3E7DF",
  },
  dark: {
    background: "#121914",
    surface: "#1C2720",
    color: "#F1F5ED",
    muted: "#B5C4B5",
    primary: "#B8DCC0",
    primaryPress: "#9DC6A6",
    onPrimary: "#122519",
    border: "#526252",
    controlBorder: "#7D8C7E",
    success: "#223E2B",
    successText: "#B9E6C4",
    warning: "#41351B",
    warningText: "#FFE0A0",
    error: "#462724",
    errorText: "#FFBDB6",
    disabled: "#303B33",
  },
} as const;

export const metrics = {
  touch: 48,
  icon: { small: 20, medium: 24 },
  space: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
  radius: { control: 12, card: 22 },
  shadow: "0px 4px 16px rgba(0, 0, 0, 0.02)",
} as const;

export const typography = {
  size: { 1: 12, 2: 14, 3: 15, 4: 16, 5: 18, 6: 20, 7: 24, 8: 30, 9: 36 },
  lineHeight: { 1: 18, 2: 21, 3: 23, 4: 24, 5: 27, 6: 30, 7: 34, 8: 40, 9: 48 },
} as const;
