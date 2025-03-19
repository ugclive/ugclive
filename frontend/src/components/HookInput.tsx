
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface HookInputProps {
  value: string;
  onChange: (value: string) => void;
  step: number;
  totalSteps: number;
}

const defaultHooks = [
  "Fun fact: you're probably wasting 10x more time...",
  "The one thing nobody tells you about productivity...",
  "I discovered this weird trick that doubled my results...",
  "Most people don't know this simple hack...",
  "Here's why you're doing it all wrong..."
];

const HookInput = ({ value, onChange, step, totalSteps }: HookInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);

  useEffect(() => {
    // Set a default hook on initial render if none exists
    if (!value) {
      onChange(defaultHooks[0]);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const showPreviousExample = () => {
    const newIndex = (currentExampleIndex - 1 + defaultHooks.length) % defaultHooks.length;
    setCurrentExampleIndex(newIndex);
    onChange(defaultHooks[newIndex]);
  };

  const showNextExample = () => {
    const newIndex = (currentExampleIndex + 1) % defaultHooks.length;
    setCurrentExampleIndex(newIndex);
    onChange(defaultHooks[newIndex]);
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">
          {step}. Hook <span className="text-muted-foreground font-normal">(catchy opener)</span>
        </h3>
        <span className="text-sm text-muted-foreground">{step}/{totalSteps}</span>
      </div>
      
      <div 
        className={cn(
          "relative rounded-lg border px-4 py-2 flex items-center bg-background shadow-sm smooth-transition",
          isFocused ? "border-primary ring-1 ring-primary" : "border-border"
        )}
      >
        <button 
          className="p-1 rounded-full hover:bg-secondary flex-shrink-0"
          aria-label="Previous example"
          onClick={showPreviousExample}
        >
          <ChevronLeft size={18} />
        </button>
        
        <div className="flex-1 px-3">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={defaultHooks[0]}
            className="border-none outline-none focus-visible:ring-0"
          />
        </div>
        
        <button 
          className="p-1 rounded-full hover:bg-secondary flex-shrink-0"
          aria-label="Next example"
          onClick={showNextExample}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default HookInput;
