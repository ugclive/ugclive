import React, { useEffect, useRef } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useInView } from "react-intersection-observer";
import useEmblaCarousel from "embla-carousel-react";

interface AutoCarouselProps {
  children: React.ReactNode[];
  itemsPerView?: number;
  autoScrollInterval?: number;
  className?: string;
}

type CarouselApi = ReturnType<typeof useEmblaCarousel>[1];

const AutoCarousel = ({
  children,
  itemsPerView = 3,
  autoScrollInterval = 3000,
  className,
}: AutoCarouselProps) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const { ref, inView } = useInView({
    threshold: 0.3,
  });
  const intervalRef = useRef<number | null>(null);

  const startAutoScroll = () => {
    if (intervalRef.current) return;
    
    intervalRef.current = window.setInterval(() => {
      if (api) api.scrollNext();
    }, autoScrollInterval);
  };

  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (inView) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
    
    return () => stopAutoScroll();
  }, [inView, api]);

  return (
    <div ref={ref} className={className}>
      <Carousel
        opts={{
          align: "start",
          loop: true,
          slidesToScroll: 1,
        }}
        setApi={setApi}
        onMouseEnter={stopAutoScroll}
        onMouseLeave={() => inView && startAutoScroll()}
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {children.map((child, index) => (
            <CarouselItem 
              key={index} 
              className="pl-2 md:pl-4" 
              style={{ flex: `0 0 ${100 / Math.min(itemsPerView, children.length)}%` }}
            >
              {child}
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="flex justify-center mt-4">
          <CarouselPrevious className="static translate-y-0 mx-2" />
          <CarouselNext className="static translate-y-0 mx-2" />
        </div>
      </Carousel>
    </div>
  );
};

export default AutoCarousel; 