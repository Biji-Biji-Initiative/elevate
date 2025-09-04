import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios';

// Helper function to extract error message from Axios error
function extractAxiosErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle Axios error response
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    return axiosError.response?.data?.message || axiosError.message || 'Request failed';
  }
  
  return String(error);
}

export interface KajabiContact {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
}

export interface KajabiContactResponse {
  contact: KajabiContact;
}

export interface KajabiContactsResponse {
  contacts: KajabiContact[];
  meta: {
    total_count: number;
    current_page: number;
    total_pages: number;
  };
}

export interface KajabiOfferResponse {
  success: boolean;
  message?: string;
}

export interface KajabiTag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface KajabiTagResponse {
  success: boolean;
  message?: string;
}

export interface KajabiTagsResponse {
  tags: KajabiTag[];
}

export interface CreateContactData {
  email: string;
  first_name?: string;
  last_name?: string;
}

export class KajabiClient {
  private client: AxiosInstance;
  private apiKey: string;
  private clientSecret: string;

  constructor(apiKey: string, clientSecret: string) {
    this.apiKey = apiKey;
    this.clientSecret = clientSecret;
    
    this.client = axios.create({
      baseURL: 'https://api.kajabi.com',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Kajabi-Client-Secret': clientSecret,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        throw error;
      }
    );
  }

  /**
   * Create or update a contact in Kajabi
   * If contact exists, it will be updated with new information
   */
  async createOrUpdateContact(email: string, name: string): Promise<KajabiContact> {
    try {
      // Parse name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] ?? '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const contactData: CreateContactData = {
        email: email.toLowerCase().trim(),
        first_name: firstName,
        last_name: lastName,
      };

      // First, try to find existing contact
      const existingContact = await this.findContactByEmail(email);
      
      if (existingContact) {
        // Update existing contact
        const response: AxiosResponse<KajabiContactResponse> = await this.client.put(
          `/contacts/${existingContact.id}`,
          { contact: contactData }
        );
        return response.data.contact;
      } else {
        // Create new contact
        const response: AxiosResponse<KajabiContactResponse> = await this.client.post(
          '/contacts',
          { contact: contactData }
        );
        return response.data.contact;
      }
    } catch (error: unknown) {
      const errorMessage = extractAxiosErrorMessage(error);
      throw new Error(`Failed to create or update contact: ${errorMessage}`);
    }
  }

  /**
   * Find a contact by email address
   */
  async findContactByEmail(email: string): Promise<KajabiContact | null> {
    try {
      const response: AxiosResponse<KajabiContactsResponse> = await this.client.get(
        `/contacts?email=${encodeURIComponent(email.toLowerCase().trim())}`
      );
      
      const firstContact = response.data.contacts[0];
      return firstContact ?? null;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      const errorMessage = extractAxiosErrorMessage(error);
      throw new Error(`Failed to find contact: ${errorMessage}`);
    }
  }

  /**
   * Grant an offer to a contact
   */
  async grantOffer(contactId: number, offerId: number): Promise<boolean> {
    try {
      const response: AxiosResponse<KajabiOfferResponse> = await this.client.post(
        `/contacts/${contactId}/offers/${offerId}/grant`
      );
      
      return response.data.success || response.status === 200 || response.status === 201;
    } catch (error: unknown) {
      const errorMessage = extractAxiosErrorMessage(error);
      throw new Error(`Failed to grant offer: ${errorMessage}`);
    }
  }

  /**
   * Add a tag to a contact
   */
  async tagContact(contactId: number, tagId: number): Promise<boolean> {
    try {
      const response: AxiosResponse<KajabiTagResponse> = await this.client.post(
        `/contacts/${contactId}/tags/${tagId}`
      );
      
      return response.data.success || response.status === 200 || response.status === 201;
    } catch (error: unknown) {
      const errorMessage = extractAxiosErrorMessage(error);
      throw new Error(`Failed to tag contact: ${errorMessage}`);
    }
  }

  /**
   * Remove a tag from a contact
   */
  async untagContact(contactId: number, tagId: number): Promise<boolean> {
    try {
      const response = await this.client.delete(
        `/contacts/${contactId}/tags/${tagId}`
      );
      
      return response.status === 200 || response.status === 204;
    } catch (error: unknown) {
      const errorMessage = extractAxiosErrorMessage(error);
      throw new Error(`Failed to remove tag: ${errorMessage}`);
    }
  }

  /**
   * Get all tags for a contact
   */
  async getContactTags(contactId: number): Promise<KajabiTag[]> {
    try {
      const response: AxiosResponse<KajabiTagsResponse> = await this.client.get(`/contacts/${contactId}/tags`);
      return response.data.tags || [];
    } catch (error: unknown) {
      const errorMessage = extractAxiosErrorMessage(error);
      throw new Error(`Failed to get contact tags: ${errorMessage}`);
    }
  }

  /**
   * Health check for Kajabi API connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch contacts with a limit of 1 to test connection
      const response = await this.client.get('/contacts?limit=1');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance factory
let kajabiClient: KajabiClient | null = null;

export function getKajabiClient(): KajabiClient {
  if (!kajabiClient) {
    const apiKey = process.env.KAJABI_API_KEY;
    const clientSecret = process.env.KAJABI_CLIENT_SECRET;

    if (!apiKey || !clientSecret) {
      throw new Error('KAJABI_API_KEY and KAJABI_CLIENT_SECRET must be set in environment variables');
    }

    kajabiClient = new KajabiClient(apiKey, clientSecret);
  }

  return kajabiClient;
}

// Helper function to create client with custom credentials (for testing)
export function createKajabiClient(apiKey: string, clientSecret: string): KajabiClient {
  return new KajabiClient(apiKey, clientSecret);
}