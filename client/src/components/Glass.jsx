const Glass = ({
  children,
  className = "",
  style = {},
  onClick,
  theme,
  ...props
}) => {
  const defaultStyle = {
    background: theme?.colors?.glass || "rgba(0,0,0,0.1)",
    border: `1px solid ${theme?.colors?.glassBorder || "rgba(255,255,255,0.1)"}`,
    backdropFilter: "blur(10px)",
    borderRadius: theme?.cardRadius || 16,
    padding: "16px",
  };

  return (
    <div
      className={className}
      style={{ ...defaultStyle, ...style }}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default Glass;
