const MoodIcon = ({ mood, theme, size = 64 }) => {
  const accentColor = theme?.colors?.accent || "#95D5B2";

  const icons = {
    forest: {
      energized: (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          <path
            d="M32 8L48 24L45 35L50 48L32 52L14 48L19 35L16 24L32 8Z"
            fill={accentColor}
          />
        </svg>
      ),
      focused: (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="24" fill={accentColor} />
          <circle cx="32" cy="32" r="16" fill={theme?.colors?.bg2} />
        </svg>
      ),
      calm: (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          <path
            d="M8 32Q16 24 32 24T56 32"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M8 40Q16 48 32 48T56 40"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
          />
        </svg>
      ),
      tired: (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          <path
            d="M16 32L32 48L48 32"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="24" cy="20" r="3" fill={accentColor} />
          <circle cx="40" cy="20" r="3" fill={accentColor} />
        </svg>
      ),
      stressed: (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          <path
            d="M16 16L48 48M48 16L16 48"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="28" stroke={accentColor} strokeWidth="2" fill="none" />
        </svg>
      ),
      neutral: (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
          <path
            d="M16 32L48 32"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="24" cy="20" r="3" fill={accentColor} />
          <circle cx="40" cy="20" r="3" fill={accentColor} />
        </svg>
      ),
    },
  };

  // Default to forest icons if theme not found
  const themeIcons = icons[theme?.id] || icons.forest;
  return themeIcons[mood] || null;
};

export default MoodIcon;
