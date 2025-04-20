# Adding Videos to the Landing Page

This guide explains how to add real videos to the UGClive landing page carousel.

## Directory Structure

Videos and thumbnails should be placed in the following directories:

- **Videos**: `/public/videos/`
- **Thumbnails**: `/public/images/thumbnails/`

## File Format Recommendations

For optimal performance:

- **Videos**: Use MP4 format with H.264 encoding, recommended resolution 1280x720p or 1920x1080p
- **Thumbnails**: Use JPG or PNG format, with the same aspect ratio as your videos (16:9 recommended)
- **File Size**: Keep videos under 5MB for faster loading, compress thumbnails appropriately

## Steps to Add Your Own Videos

1. **Prepare your video files**:
   - Create or obtain video clips (optimally 10-30 seconds long)
   - Create thumbnail images for each video
   - Name them consistently (e.g., "product-demo.mp4" and "product-demo.jpg")

2. **Add files to public directory**:
   - Place video files in `/public/videos/`
   - Place thumbnail images in `/public/images/thumbnails/`

3. **Update the video data**:
   - Open `src/pages/Landing.tsx`
   - Find the `SAMPLE_VIDEOS` array
   - Update the entries with your file paths and descriptions

## Example:

```typescript
const SAMPLE_VIDEOS = [
  {
    id: 1,
    title: "Product Demo",
    description: "Generate engaging product demos in seconds.",
    thumbnail: "/images/thumbnails/your-thumbnail.jpg",
    videoUrl: "/videos/your-video.mp4",
    gradient: "bg-gradient-to-r from-blue-500 to-indigo-600" // Optional fallback
  },
  // Add more videos as needed
];
```

## Using Placeholder Gradients

If you don't have thumbnails yet, you can rely on the gradient backgrounds by not providing a thumbnail:

```typescript
{
  id: 1,
  title: "Product Demo",
  description: "Your description here",
  // No thumbnail provided - will use gradient
  videoUrl: "/videos/your-video.mp4",
  gradient: "bg-gradient-to-r from-blue-500 to-indigo-600"
}
```

## Gradient Options

Here are some gradient options you can use:

- `bg-gradient-to-r from-blue-500 to-indigo-600`
- `bg-gradient-to-r from-indigo-500 to-purple-600`
- `bg-gradient-to-r from-purple-500 to-pink-600`
- `bg-gradient-to-r from-pink-500 to-rose-600`
- `bg-gradient-to-r from-rose-500 to-red-600`
- `bg-gradient-to-r from-red-500 to-orange-600`
- `bg-gradient-to-r from-orange-500 to-amber-600`
- `bg-gradient-to-r from-amber-500 to-yellow-600`
- `bg-gradient-to-r from-yellow-500 to-lime-600`
- `bg-gradient-to-r from-lime-500 to-green-600`
- `bg-gradient-to-r from-green-500 to-emerald-600`
- `bg-gradient-to-r from-emerald-500 to-teal-600`
- `bg-gradient-to-r from-teal-500 to-cyan-600`
- `bg-gradient-to-r from-cyan-500 to-sky-600`
- `bg-gradient-to-r from-sky-500 to-blue-600` 