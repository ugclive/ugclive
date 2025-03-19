
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Film, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

interface Demo {
  id: number;
  demo_link: string;
  created_at: string;
}

interface DemoGridProps {
  selectedDemo: number | null;
  onSelectDemo: (demoId: number | null) => void;
  onAddDemo: () => void;
  step: number;
  totalSteps: number;
}

const DemoGrid = ({ selectedDemo, onSelectDemo, onAddDemo, step, totalSteps }: DemoGridProps) => {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchDemos = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('demo')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setDemos(data || []);
      } catch (error) {
        console.error('Error fetching demos:', error);
        toast.error('Failed to load demos');
      } finally {
        setLoading(false);
      }
    };

    fetchDemos();
    
    // Listen for demo upload events to refresh the grid
    const handleDemoUploaded = () => {
      fetchDemos();
    };
    
    window.addEventListener('demoUploaded', handleDemoUploaded);
    
    return () => {
      window.removeEventListener('demoUploaded', handleDemoUploaded);
    };
  }, [user]);

  const handleResetDemo = () => {
    onSelectDemo(null);
    toast.success('Demo selection reset');
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">3. Demos</h3>
        <div className="flex items-center gap-2">
          {selectedDemo !== null && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResetDemo}
              className="text-xs h-7 px-2"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{step}/{totalSteps}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <div 
          className="aspect-square rounded-lg border border-border flex items-center justify-center cursor-pointer hover:bg-secondary/50 smooth-transition"
          onClick={onAddDemo}
        >
          <div className="flex flex-col items-center text-muted-foreground">
            <Plus className="h-5 w-5 mb-1" />
            <span className="text-xs">Add Demo</span>
          </div>
        </div>
        
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div 
              key={`skeleton-${index}`} 
              className="aspect-square rounded-lg bg-secondary/40 animate-pulse"
            />
          ))
        ) : (
          demos.map((demo) => (
            <div 
              key={demo.id}
              className={`aspect-square rounded-lg border ${selectedDemo === demo.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'} overflow-hidden relative cursor-pointer hover:opacity-90 smooth-transition`}
              onClick={() => onSelectDemo(demo.id)}
            >
              <video 
                src={demo.demo_link}
                className="w-full h-full object-cover"
                muted
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 smooth-transition">
                <Film className="h-8 w-8 text-white" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DemoGrid;
