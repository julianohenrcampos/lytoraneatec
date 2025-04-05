
import { supabase } from "./client";

// Function to create the apontamentos bucket
export const createApontamentosBucket = async () => {
  try {
    const { data, error } = await supabase.storage.createBucket('apontamentos', {
      public: true,
    });

    if (error) {
      console.error('Error creating apontamentos bucket:', error);
      return;
    }

    console.log('Apontamentos bucket created successfully:', data);
  } catch (error) {
    console.error('Error setting up storage:', error);
  }
};

// Function to check if the bucket exists and create it if it doesn't
export const setupStorage = async () => {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }

    const apontamentosBucketExists = buckets.some(bucket => bucket.name === 'apontamentos');
    
    if (!apontamentosBucketExists) {
      await createApontamentosBucket();
    }
  } catch (error) {
    console.error('Error setting up storage:', error);
  }
};
