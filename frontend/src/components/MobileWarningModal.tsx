
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";

export const MobileWarningModal = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setIsOpen(true);
    }
  }, [isMobile]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="h-screen w-screen max-w-none p-6 m-0 rounded-none flex flex-col justify-center items-center"
        showCloseButton={false}
      >
        <DialogHeader className="text-center flex flex-col items-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
          <DialogTitle className="text-2xl mb-4">Mobile Experience Limited</DialogTitle>
          <DialogDescription className="text-base max-w-md mx-auto">
            This application is not yet optimized for mobile devices. For the best experience, 
            please use a desktop or laptop computer to access all features and functionality.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
