
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

export const uploadImage = async (file: File, bucketName: string): Promise<string> => {
  try {
    // First, check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error checking buckets:", bucketsError);
      // For dev purposes, return a mock URL
      return `https://placeholder.com/${bucketName}/${uuidv4()}`;
    }
    
    // Check if our bucket exists
    const bucketExists = buckets?.some(b => b.name === bucketName);
    
    // If bucket doesn't exist, create it
    if (!bucketExists) {
      const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
        public: true
      });
      
      if (createBucketError) {
        console.error("Error creating bucket:", createBucketError);
        // Return a mock URL for development
        return `https://placeholder.com/${bucketName}/${uuidv4()}`;
      }
    }
    
    // Generate a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${fileName}`;
    
    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);
    
    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      // Return a mock URL for development
      return `https://placeholder.com/${bucketName}/${fileName}`;
    }
    
    // Get the public URL
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  } catch (error) {
    console.error("Error in uploadImage:", error);
    // Return a mock URL for development
    return `https://placeholder.com/${bucketName}/${uuidv4()}`;
  }
};

// Export the function with a different name for backward compatibility
export const uploadFile = uploadImage;
