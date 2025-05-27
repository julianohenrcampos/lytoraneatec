
import { supabase } from "./client";

// Function to set up and check storage for veiculos
export const setupVeiculosStorage = async () => {
  try {
    // Check if the veiculos bucket exists
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }

    const veiculosBucketExists = buckets.some(bucket => bucket.name === 'veiculos');
    
    if (!veiculosBucketExists) {
      console.log('Creating veiculos bucket...');
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket('veiculos', {
        public: true
      });
      
      if (createError) {
        console.error('Error creating veiculos bucket:', createError);
      } else {
        console.log('Veiculos bucket created successfully');
      }
    } else {
      console.log('Veiculos bucket already exists');
    }
  } catch (error) {
    console.error('Error setting up veiculos storage:', error);
  }
};

// Initialize storage when the module is loaded
setupVeiculosStorage().catch(err => {
  console.error('Failed to initialize storage:', err);
});
