import { getKajabiClient } from './kajabi';

/**
 * Utility functions for Kajabi integration
 */

export interface EnrollmentResult {
  success: boolean;
  contactId?: number;
  error?: string;
}

/**
 * Enroll a user in Kajabi and optionally grant offers or add tags
 */
export async function enrollUserInKajabi(
  email: string,
  name: string,
  options?: {
    offerId?: number;
    tagId?: number;
  }
): Promise<EnrollmentResult> {
  try {
    const client = getKajabiClient();
    
    // Create or update contact
    const contact = await client.createOrUpdateContact(email, name);
    
    // Grant offer if provided
    if (options?.offerId) {
      await client.grantOffer(contact.id, options.offerId);
    }
    
    // Add tag if provided
    if (options?.tagId) {
      await client.tagContact(contact.id, options.tagId);
    }
    
    return {
      success: true,
      contactId: contact.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if Kajabi API is accessible
 */
export async function isKajabiHealthy(): Promise<boolean> {
  try {
    const client = getKajabiClient();
    return await client.healthCheck();
  } catch (error) {
    return false;
  }
}

/**
 * Safe Kajabi client getter that doesn't throw if credentials are missing
 */
export function tryGetKajabiClient() {
  try {
    return getKajabiClient();
  } catch (error) {
    return null;
  }
}
