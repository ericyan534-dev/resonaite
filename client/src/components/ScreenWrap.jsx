import { useLocation } from "react-router-dom";

const ScreenWrap = ({ children }) => {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      style={{
        animation: "slideIn 0.3s ease-out",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
};

export default ScreenWrap;
