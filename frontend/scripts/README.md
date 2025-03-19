
# Supabase Setup Scripts

This directory contains scripts for cloning and setting up your Supabase project.

## Deployment Options

This application can be deployed in two ways:

1. **Frontend + Hosted Supabase**: Deploy the frontend to Vercel and use Supabase cloud for the backend
2. **Self-hosted**: Deploy the frontend to Vercel and self-host Supabase on your own device/server

## Frontend Deployment (Vercel)

To deploy the frontend to Vercel:

1. Connect your GitHub repository to Vercel
2. Set the following environment variables in Vercel:
   ```
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Deploy your project

## Backend Deployment Options

### Option 1: Using Supabase Cloud

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Run the export script to generate the SQL:
   ```bash
   node supabase-export.js > supabase-setup.sql
   ```
3. Navigate to the SQL Editor in your Supabase project
4. Copy the contents of the generated `supabase-setup.sql` file
5. Paste the SQL into the editor and run the script
6. Copy your Supabase URL and anon key to use in your frontend deployment

### Option 2: Self-hosting Supabase

#### Prerequisites
- Docker and Docker Compose installed
- Git installed
- 4GB RAM minimum (8GB+ recommended)
- 2 CPU cores minimum

#### Setup Steps

1. Clone the Supabase repository:
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   ```

2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```

3. Update the `.env` file with your own passwords and settings

4. Start the Supabase services:
   ```bash
   docker-compose up -d
   ```

5. When the services are running, visit the Studio at `http://localhost:8000`

6. Run the database setup script:
   ```bash
   # Navigate to SQL Editor and paste the contents of:
   node supabase-export.js > supabase-setup.sql
   ```

7. Configure your frontend to use your self-hosted Supabase instance:
   ```
   VITE_SUPABASE_URL=http://your-device-ip:8000
   VITE_SUPABASE_ANON_KEY=your-generated-anon-key
   ```

## Giving Users Access

### For Developers

Provide them with:
1. The GitHub repository link for the frontend code
2. Instructions for either:
   - Creating their own Supabase project and running the SQL script
   - Setting up self-hosted Supabase using Docker

### For End Users

1. Deploy the frontend to Vercel connected to your Supabase instance
2. Share the deployed application URL with your users

## What Gets Cloned

This script will recreate:

- Enum types
- Database tables with the correct columns and defaults
- Foreign key relationships
- Row Level Security (RLS) policies 
- Realtime configuration for the `generated_videos` table
- Auth hooks for user creation
- Comments on tables
- Storage buckets and their settings
- Storage RLS policies

## Storage Buckets

The script will create the following storage buckets with appropriate RLS policies:

- `sound`: For audio files used in video generation
- `template`: For video templates 
- `generated-videos`: For storing generated video content
- `user-templates`: For user-uploaded templates

## Manual Configuration Steps

After running the script, you may need to:

1. Configure authentication providers in the Supabase dashboard
2. Set up any edge functions
3. Configure environment variables in your application

## Environment Variables

Remember to update your application's environment variables to point to the correct Supabase instance:

```
VITE_SUPABASE_URL=https://your-supabase-instance.com
VITE_SUPABASE_ANON_KEY=your-anon-key
```
