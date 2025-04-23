import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Check, ArrowRight, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import LogoIcon from "@/components/LogoIcon";
import { useAuth } from "@/contexts/AuthContext";
import AutoCarousel from "@/components/AutoCarousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoCard from "@/components/VideoCard";

// Sample video data for the carousel
const SAMPLE_VIDEOS = [
  {
    id: 1,
    title: "Product Demo",
    description: "Generate engaging product demos in seconds.",
    thumbnail: "/images/thumbnails/product-demo.jpg",
    videoUrl: "/videos/product-demo.mp4",
    gradient: "bg-gradient-to-r from-blue-500 to-indigo-600"
  },
  {
    id: 2,
    title: "Testimonial",
    description: "Create authentic-looking testimonials with AI.",
    thumbnail: "/images/thumbnails/testimonial.jpg",
    videoUrl: "/videos/testimonial.mp4",
    gradient: "bg-gradient-to-r from-indigo-500 to-purple-600"
  },
  {
    id: 3,
    title: "Tutorial",
    description: "Explain your product features with tutorial videos.",
    thumbnail: "/images/thumbnails/tutorial.jpg",
    videoUrl: "/videos/tutorial.mp4",
    gradient: "bg-gradient-to-r from-purple-500 to-pink-600"
  },
  {
    id: 4,
    title: "Social Ad",
    description: "Create scroll-stopping ads for social media.",
    thumbnail: "/images/thumbnails/social-ad.jpg",
    videoUrl: "/videos/social-ad.mp4",
    gradient: "bg-gradient-to-r from-pink-500 to-rose-600"
  },
  {
    id: 5,
    title: "Explainer",
    description: "Explain complex topics with simple AI videos.",
    thumbnail: "/images/thumbnails/explainer.jpg",
    videoUrl: "/videos/explainer.mp4",
    gradient: "bg-gradient-to-r from-red-500 to-orange-600"
  },
  {
    id: 6,
    title: "Product Showcase",
    description: "Show off your products with vibrant videos.",
    thumbnail: "/images/thumbnails/product-showcase.jpg",
    videoUrl: "/videos/product-showcase.mp4",
    gradient: "bg-gradient-to-r from-orange-500 to-amber-600"
  }
];

const Landing = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signInWithOAuth } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await signInWithOAuth('google');
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <header className="py-6 px-4 sm:px-6 lg:px-8 border-b">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <LogoIcon size={32} />
            <h1 className="text-2xl font-bold text-primary">UGClive</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <Button onClick={goToDashboard}>
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleGoogleLogin} disabled={isLoading}>
                Start Now {isLoading && <span className="ml-2 animate-spin">⟳</span>}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 text-center">
          <div className="container mx-auto max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
              Create Viral Videos with AI
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Generate trending content in seconds with our advanced AI. Perfect for creators, marketers, and businesses looking to go viral.
            </p>
            {user ? (
              <Button size="lg" className="px-8 py-6 text-lg" onClick={goToDashboard}>
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" className="px-8 py-6 text-lg" onClick={handleGoogleLogin} disabled={isLoading}>
                Start Now {isLoading && <span className="ml-2 animate-spin">⟳</span>}
              </Button>
            )}
          </div>
        </section>

        {/* Trust Banner */}
        <section className="py-8 border-y bg-muted/10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center">
              <div className="flex items-center mb-2">
                <div className="text-yellow-500 flex">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-2xl">★</span>
                  ))}
                </div>
                <span className="ml-2 text-xl font-bold">4.8</span>
              </div>
              <p className="text-muted-foreground text-center">
                Trusted by 300+ brands with $100M+ in revenue
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-4">The fastest way to create AI videos</h2>
            <p className="text-lg text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
              Create engaging UGC-style videos with our advanced AI technology in just a few easy steps.
            </p>
            
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary font-bold text-xl">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-3">Write your script</h3>
                <p className="text-muted-foreground">
                  Enter or automatically generate a script that aligns with your brand's message to personalize your AI-generated video.
                </p>
              </div>
              
              <div className="text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary font-bold text-xl">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-3">Pick an avatar</h3>
                <p className="text-muted-foreground">
                  Select from over 100 unique AI avatars to represent your brand's style and give a visual identity to your video.
                </p>
              </div>
              
              <div className="text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary font-bold text-xl">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-3">Generate your video</h3>
                <p className="text-muted-foreground">
                  Combine the selected avatar and script to quickly produce a high-quality, personalized video for your brand in minutes.
                </p>
              </div>
            </div>
            
            <div className="mt-12 text-center">
              <Button size="lg" className="px-8" onClick={user ? goToDashboard : handleGoogleLogin} disabled={isLoading}>
                {user ? "Go to Dashboard" : "Start Now"} {!user && isLoading && <span className="ml-2 animate-spin">⟳</span>}
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-12">Why Choose UGClive?</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-primary text-xl font-bold">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">AI-Powered Content</h3>
                <p className="text-muted-foreground">Our advanced AI analyzes trending content to create videos that resonate with audiences.</p>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-primary text-xl font-bold">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Time-Saving</h3>
                <p className="text-muted-foreground">Generate weeks worth of content in minutes, not hours or days.</p>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-primary text-xl font-bold">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Proven Results</h3>
                <p className="text-muted-foreground">Join thousands of creators who've increased their engagement by 300% using our platform.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Video Showcase Carousel */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-4">Create custom AI Videos</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              UGClive seamlessly integrates advanced AI technology with a personalized approach, empowering you to elevate your brand with professional videos.
            </p>
            
            <AutoCarousel
              itemsPerView={3}
              autoScrollInterval={3000}
              className="w-full"
            >
              {SAMPLE_VIDEOS.map((video) => (
                <VideoCard 
                  key={video.id}
                  src={video.videoUrl}
                  poster={video.thumbnail}
                  className={video.gradient}
                />
              ))}
            </AutoCarousel>
            
            <div className="mt-12 text-center">
              <Button size="lg" className="px-8" onClick={user ? goToDashboard : handleGoogleLogin} disabled={isLoading}>
                {user ? "Go to Dashboard" : "Start Now"} {!user && isLoading && <span className="ml-2 animate-spin">⟳</span>}
              </Button>
            </div>
          </div>
        </section>

        {/* Creators Showcase */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-4">Choose from our AI Creators</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Select from a diverse range of AI avatars to represent your brand and create compelling videos.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="relative group overflow-hidden rounded-xl">
                  <div className="aspect-[3/4] bg-gradient-to-b from-purple-500 to-indigo-700 flex items-end justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute bottom-0 w-full p-3 bg-gradient-to-t from-black/70 to-transparent">
                      <p className="text-white font-medium text-center">
                        {["Olivia", "Curtis", "James", "Emma", "Ava", "Mary", "John", "Michael"][index]} 
                      </p>
                      <p className="text-white/70 text-xs text-center">
                        {["Professional", "Casual", "Enthusiastic", "Friendly", "Serious", "Energetic", "Calm", "Confident"][index]}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <Button variant="outline" size="lg" className="px-8" onClick={user ? goToDashboard : handleGoogleLogin} disabled={isLoading}>
                {user ? "Go to Dashboard" : "Start Now"} {!user && isLoading && <span className="ml-2 animate-spin">⟳</span>}
              </Button>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-16">What they're saying</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col h-full">
                  <p className="italic text-muted-foreground mb-6">
                    "We went from spending days developing content to generating it in a fraction of the time. The platform's powerful AI makes creating high-quality content quick and easy, allowing us to focus more on strategy and growth."
                  </p>
                  <div className="mt-auto">
                    <h4 className="font-semibold">Patrick Qureshi</h4>
                    <p className="text-sm text-muted-foreground">Founder Sharewine</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col h-full">
                  <p className="italic text-muted-foreground mb-6">
                    "Creating content used to be a complicated and time-consuming process. UGClive simplified everything, allowing us to go from concept to finished content in just a few easy steps."
                  </p>
                  <div className="mt-auto">
                    <h4 className="font-semibold">Aaron Nosbisch</h4>
                    <p className="text-sm text-muted-foreground">Founder Brez</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col h-full">
                  <p className="italic text-muted-foreground mb-6">
                    "Our team struggled with tight deadlines and constant content demands. This platform sped up our creation process, allowing us to meet deadlines without compromising quality."
                  </p>
                  <div className="mt-auto">
                    <h4 className="font-semibold">Jamora Crawford</h4>
                    <p className="text-sm text-muted-foreground">Video strategist Ketchapp</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mt-8">
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col h-full">
                  <p className="italic text-muted-foreground mb-6">
                    "We got a ROAS of 120%, giving us an unbeatable ROI on ad spend!"
                  </p>
                  <div className="mt-auto">
                    <h4 className="font-semibold">Janno Calitz</h4>
                    <p className="text-sm text-muted-foreground">Co-founder at Zitlac</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col h-full">
                  <p className="italic text-muted-foreground mb-6">
                    "UGClive has reduced our cost of content creation by $3,000 and the video generation is much faster."
                  </p>
                  <div className="mt-auto">
                    <h4 className="font-semibold">Daniel Kenny</h4>
                    <p className="text-sm text-muted-foreground">Co-founder Wassabi</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-card p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col h-full">
                  <p className="italic text-muted-foreground mb-6">
                    "We can now make UGC videos for under $9 compared to a traditional UGC video that costs around $150."
                  </p>
                  <div className="mt-auto">
                    <h4 className="font-semibold">Derrick Chen</h4>
                    <p className="text-sm text-muted-foreground">Co-founder at Xara shilajit</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-16 text-center">
              <Button size="lg" className="px-8" onClick={user ? goToDashboard : handleGoogleLogin} disabled={isLoading}>
                {user ? "Go to Dashboard" : "Start Now"} {!user && isLoading && <span className="ml-2 animate-spin">⟳</span>}
              </Button>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-12">Choose Your Plan</h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Yearly Plan */}
              <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-2xl">Yearly Plan</CardTitle>
                  <CardDescription>Perfect for creators getting started</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$149</span>
                    <span className="text-muted-foreground">/year</span>
                  </div>
                  <Separator className="mb-6" />
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>Unlimited video generations</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>Access to all AI avatars</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>Priority support</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>Regular updates</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={user ? goToDashboard : handleGoogleLogin}
                    disabled={isLoading}
                  >
                    {user ? "Go to Dashboard" : "Start Now"} {!user && isLoading && <span className="ml-2 animate-spin">⟳</span>}
                  </Button>
                </CardFooter>
              </Card>
              
              {/* Lifetime Plan */}
              <Card className="relative overflow-hidden border-primary hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg">
                  BEST VALUE
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">Lifetime Plan</CardTitle>
                  <CardDescription>For serious content creators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$299</span>
                    <span className="text-muted-foreground">/lifetime</span>
                  </div>
                  <Separator className="mb-6" />
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>Everything in Yearly Plan</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>Early access to new features</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>Premium AI avatars</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="mr-2 h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>One-time payment, lifetime access</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    size="lg" 
                    variant="default" 
                    onClick={user ? goToDashboard : handleGoogleLogin}
                    disabled={isLoading}
                  >
                    {user ? "Go to Dashboard" : "Start Now"} {!user && isLoading && <span className="ml-2 animate-spin">⟳</span>}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30" id="faq">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-center mb-4">FAQs</h2>
            <p className="text-muted-foreground text-center mb-12">
              Everything you need to know before you buy.
            </p>
            
            <div className="space-y-6">
              <div className="bg-background rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-2">How long does a video take to generate?</h3>
                <p className="text-muted-foreground">
                  After inputting a script, talking head videos take between 2-10 minutes to process. AI hook videos take between 5-10 seconds. Custom avatars can take up to 1 hour to train. If your video takes longer than this please contact our support team.
                </p>
              </div>
              
              <div className="bg-background rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-2">Can AI hold my product?</h3>
                <p className="text-muted-foreground">
                  Yes, UGClive allows you to hold, showcase and even consume your product. Once created, you can make videos in minutes like standard templated videos. Please note this feature is only available for Pro and Enterprise plan users.
                </p>
              </div>
              
              <div className="bg-background rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-2">If I edit an already generated video, will it be considered a new video?</h3>
                <p className="text-muted-foreground">
                  Yes, because the video has already been generated, and we allow you to preview the script beforehand to avoid mistakes. However, if the issue is due to a system error, we will refund the credit back to your account.
                </p>
              </div>
              
              <div className="bg-background rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-2">How do I upgrade my plan?</h3>
                <p className="text-muted-foreground">
                  You can upgrade your plan at any time in your account settings. Your current credits will be rolled over into your new plan. Upgrading will initiate a new billing cycle.
                </p>
              </div>
              
              <div className="bg-background rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-2">Are there any limits on the use of videos made with UGClive?</h3>
                <p className="text-muted-foreground">
                  No, there are no limitations. You own all of your creatives, even after your plan ends, and can use them across any channel without restrictions. All stock footage utilized in UGClive is royalty-free.
                </p>
              </div>
              
              <div className="bg-background rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-2">Do you offer a refund?</h3>
                <p className="text-muted-foreground">
                  Try UGClive risk-free! If you're not happy, we'll refund you – no questions asked.
                </p>
              </div>
            </div>
            
            <div className="mt-12 text-center">
              <Button size="lg" className="px-8" onClick={user ? goToDashboard : handleGoogleLogin} disabled={isLoading}>
                {user ? "Go to Dashboard" : "Start Now"} {!user && isLoading && <span className="ml-2 animate-spin">⟳</span>}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} UGClive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
