
import { useState, useEffect, ReactNode } from "react";
import Navbar from "@/components/Navbar";

interface NavbarWrapperProps {
  children: ReactNode;
}

const NavbarWrapper = ({ children }: NavbarWrapperProps) => {
  const [isReady, setIsReady] = useState(false);

  // Simulate initial loading - this is just to ensure the Navbar component is fully loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  );
};

export default NavbarWrapper;
