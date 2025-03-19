
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type Template = Database['public']['Tables']['templates']['Row'];
// Update to match the enum values from the database schema
export type TemplateType = Database['public']['Enums']['template_type'];

export const fetchTemplates = async (templateType?: TemplateType): Promise<Template[]> => {
  let query = supabase.from('templates').select('*');
  
  // Filter by template_type if provided
  if (templateType) {
    query = query.eq('template_type', templateType);
  }
  
  const { data, error } = await query;

  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }

  return data || [];
};

export const fetchUserGeneratedTemplates = async (userId: string): Promise<Template[]> => {
  if (!userId) {
    return [];
  }
  
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .eq('template_type', 'usergenerated');

  if (error) {
    console.error('Error fetching user generated templates:', error);
    throw error;
  }

  return data || [];
};

export const createTemplate = async (
  userId: string,
  imageLink: string,
  videoLink: string
): Promise<Template | null> => {
  if (!userId) {
    console.error('User ID is required to create a template');
    return null;
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({
      user_id: userId,
      image_link: imageLink,
      video_link: videoLink,
      template_type: 'usergenerated'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating template:', error);
    throw error;
  }

  return data;
};

export const deleteTemplate = async (templateId: number): Promise<void> => {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};
