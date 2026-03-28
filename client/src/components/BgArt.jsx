const BgArt = ({ theme }) => {
  return (
    <svg
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "120px",
        zIndex: 1,
        pointerEvents: "none",
      }}
      viewBox="0 0 1000 400"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient
          id="bgGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={theme?.colors?.bg4} />
          <stop offset="100%" stopColor={theme?.colors?.bg1} />
        </linearGradient>
      </defs>
      <path
        d={theme?.bgArt || "M0,380 Q80,340 160,360 Q280,390 400,350 Q520,310 600,340 Q700,370 800,330 Q900,290 1000,320 L1000,400 L0,400Z"}
        fill="url(#bgGradient)"
        opacity="0.6"
      />
    </svg>
  );
};

export default BgArt;
