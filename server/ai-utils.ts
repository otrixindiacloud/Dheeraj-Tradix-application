import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { storage } from './storage';

// AI-powered autofill and suggestion utilities
export class AIUtils {
  
  // Generate intelligent suggestions for form fields
  static async generateFieldSuggestions(fieldType: string, context: any = {}): Promise<string[]> {
    try {
      const prompt = `Based on the field type "${fieldType}" and context ${JSON.stringify(context)}, suggest 5-8 relevant options for autofill. 
      
      Field types and their suggestions:
      - customer_name: Suggest customer names from the system
      - product_description: Suggest product descriptions based on category
      - supplier_name: Suggest supplier names
      - item_category: Suggest relevant categories
      - payment_terms: Suggest common payment terms
      - delivery_method: Suggest delivery methods
      - enquiry_subject: Suggest enquiry subjects based on industry
      - quotation_notes: Suggest professional quotation notes
      
      Return only the suggestions as a JSON array of strings.`;

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.3,
        maxTokens: 200,
      });

      try {
        return JSON.parse(text);
      } catch {
        // Fallback to predefined suggestions
        return this.getFallbackSuggestions(fieldType);
      }
    } catch (error) {
      console.error('Error generating field suggestions:', error);
      return this.getFallbackSuggestions(fieldType);
    }
  }

  // Generate intelligent data analysis insights
  static async generateDataInsights(dataType: string, data: any[]): Promise<string> {
    try {
      // Check if API key is available and valid
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('your-')) {
        console.log('OpenAI API key not configured, using fallback insights');
        return this.getFallbackDataInsights(dataType, data);
      }

      console.log('Generating insights for dataType:', dataType, 'with', data.length, 'items');
      
      const prompt = `Analyze the following ${dataType} data and provide key insights, trends, and recommendations:

Data: ${JSON.stringify(data.slice(0, 10))} // Limit to first 10 items for context

Provide:
1. Key trends and patterns
2. Notable anomalies or outliers
3. Business recommendations
4. Areas for improvement
5. Potential risks or opportunities

Format as a clear, actionable report.`;

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.4,
        maxTokens: 500,
      });

      console.log('OpenAI response received, length:', text.length);
      return text;
    } catch (error: any) {
      console.error('Error generating data insights:', error);
      
      // Check if it's an API key error or authentication error
      const isAuthError = error.message?.includes('API key') || 
                          error.message?.includes('authentication') ||
                          error.message?.includes('invalid_api_key') ||
                          error.statusCode === 401;
      
      if (isAuthError) {
        console.log('API key error detected, using fallback insights');
        try {
          return this.getFallbackDataInsights(dataType, data);
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
          return this.getFallbackDataInsights(dataType, []);
        }
      }
      
      // For other errors, return fallback with empty data to prevent errors
      try {
        return this.getFallbackDataInsights(dataType, data);
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        return this.getFallbackDataInsights(dataType, []);
      }
    }
  }

  // Generate intelligent error explanations and fixes
  static async generateErrorAnalysis(error: string, context: any = {}): Promise<{
    explanation: string;
    suggestedFixes: string[];
    preventionTips: string[];
  }> {
    try {
      const prompt = `Analyze this error and provide helpful information:

Error: "${error}"
Context: ${JSON.stringify(context)}

Provide:
1. A clear explanation of what went wrong
2. 3-5 specific steps to fix the issue
3. 2-3 tips to prevent this error in the future

Format as JSON with keys: explanation, suggestedFixes, preventionTips`;

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.3,
        maxTokens: 400,
      });

      try {
        return JSON.parse(text);
      } catch {
        return this.getFallbackErrorAnalysis(error);
      }
    } catch (error) {
      console.error('Error generating error analysis:', error);
      return this.getFallbackErrorAnalysis(error);
    }
  }

  // Generate intelligent pricing suggestions
  static async generatePricingSuggestions(item: any, marketContext: any = {}): Promise<{
    suggestedPrice: number;
    reasoning: string;
    alternatives: { price: number; reason: string }[];
  }> {
    try {
      const prompt = `Suggest optimal pricing for this item:

Item: ${JSON.stringify(item)}
Market Context: ${JSON.stringify(marketContext)}

Consider:
- Cost price and desired margins
- Market competition
- Customer type (retail/wholesale)
- Volume discounts
- Seasonal factors

Provide:
1. Recommended price with reasoning
2. Alternative pricing strategies
3. Justification for each price point

Format as JSON with keys: suggestedPrice, reasoning, alternatives`;

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.4,
        maxTokens: 300,
      });

      try {
        return JSON.parse(text);
      } catch {
        return this.getFallbackPricing(item);
      }
    } catch (error) {
      console.error('Error generating pricing suggestions:', error);
      return this.getFallbackPricing(item);
    }
  }

  // Generate intelligent inventory recommendations
  static async generateInventoryRecommendations(inventoryData: any[]): Promise<{
    reorderItems: any[];
    slowMovingItems: any[];
    recommendations: string[];
  }> {
    try {
      const prompt = `Analyze this inventory data and provide recommendations:

Inventory Data: ${JSON.stringify(inventoryData.slice(0, 20))}

Identify:
1. Items that need reordering (low stock)
2. Slow-moving items that may need attention
3. General inventory optimization recommendations

Format as JSON with keys: reorderItems, slowMovingItems, recommendations`;

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.3,
        maxTokens: 400,
      });

      try {
        return JSON.parse(text);
      } catch {
        return this.getFallbackInventoryRecommendations(inventoryData);
      }
    } catch (error) {
      console.error('Error generating inventory recommendations:', error);
      return this.getFallbackInventoryRecommendations(inventoryData);
    }
  }

  // Generate intelligent customer insights
  static async generateCustomerInsights(customerData: any[]): Promise<{
    topCustomers: any[];
    insights: string[];
    recommendations: string[];
  }> {
    try {
      const prompt = `Analyze this customer data and provide insights:

Customer Data: ${JSON.stringify(customerData.slice(0, 15))}

Provide:
1. Top performing customers
2. Key insights about customer behavior
3. Recommendations for customer retention and growth

Format as JSON with keys: topCustomers, insights, recommendations`;

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.4,
        maxTokens: 400,
      });

      try {
        return JSON.parse(text);
      } catch {
        return this.getFallbackCustomerInsights(customerData);
      }
    } catch (error) {
      console.error('Error generating customer insights:', error);
      return this.getFallbackCustomerInsights(customerData);
    }
  }

  // Fallback methods for when AI is not available
  private static getFallbackSuggestions(fieldType: string): string[] {
    const suggestions: Record<string, string[]> = {
      customer_name: ['ABC Corporation', 'XYZ Ltd', 'Global Industries', 'Tech Solutions Inc'],
      product_description: ['High-quality product', 'Premium grade', 'Standard specification', 'Custom solution'],
      supplier_name: ['Supplier A', 'Supplier B', 'Local Vendor', 'International Supplier'],
      item_category: ['Electronics', 'Office Supplies', 'Raw Materials', 'Finished Goods'],
      payment_terms: ['Net 30', 'Net 15', 'Cash on Delivery', 'Advance Payment'],
      delivery_method: ['Standard Shipping', 'Express Delivery', 'Pickup', 'Courier'],
      enquiry_subject: ['Product Inquiry', 'Service Request', 'Pricing Information', 'Technical Support'],
      quotation_notes: ['Terms and conditions apply', 'Valid for 30 days', 'Subject to availability', 'Prices exclude taxes']
    };
    
    return suggestions[fieldType] || ['Option 1', 'Option 2', 'Option 3'];
  }

  private static getFallbackErrorAnalysis(error: string): {
    explanation: string;
    suggestedFixes: string[];
    preventionTips: string[];
  } {
    return {
      explanation: 'An error occurred in the system. This could be due to data validation, network issues, or system constraints.',
      suggestedFixes: [
        'Check your input data for accuracy',
        'Refresh the page and try again',
        'Contact system administrator if issue persists'
      ],
      preventionTips: [
        'Ensure all required fields are filled',
        'Check your internet connection',
        'Save your work frequently'
      ]
    };
  }

  private static getFallbackPricing(item: any): {
    suggestedPrice: number;
    reasoning: string;
    alternatives: { price: number; reason: string }[];
  } {
    const costPrice = item.costPrice || 0;
    const suggestedPrice = costPrice * 1.5; // 50% markup
    
    return {
      suggestedPrice,
      reasoning: 'Standard 50% markup applied based on cost price',
      alternatives: [
        { price: costPrice * 1.3, reason: 'Conservative pricing (30% markup)' },
        { price: costPrice * 1.7, reason: 'Premium pricing (70% markup)' }
      ]
    };
  }

  private static getFallbackInventoryRecommendations(inventoryData: any[]): {
    reorderItems: any[];
    slowMovingItems: any[];
    recommendations: string[];
  } {
    const reorderItems = inventoryData.filter(item => (item.totalQuantity || 0) < 10);
    const slowMovingItems = inventoryData.filter(item => (item.totalQuantity || 0) > 100);
    
    return {
      reorderItems,
      slowMovingItems,
      recommendations: [
        'Review reorder points for low-stock items',
        'Consider promotional activities for slow-moving items',
        'Implement automated reorder alerts'
      ]
    };
  }

  private static getFallbackCustomerInsights(customerData: any[]): {
    topCustomers: any[];
    insights: string[];
    recommendations: string[];
  } {
    const topCustomers = customerData.slice(0, 5);
    
    return {
      topCustomers,
      insights: [
        'Customer data shows varied engagement levels',
        'Some customers have higher transaction volumes'
      ],
      recommendations: [
        'Focus on high-value customer relationships',
        'Implement customer retention programs',
        'Regular follow-up with key customers'
      ]
    };
  }

  private static getFallbackDataInsights(dataType: string, data: any[]): string {
    // Safely handle empty or invalid data
    const dataCount = Array.isArray(data) ? data.length : 0;
    const safeData = Array.isArray(data) ? data : [];
    
    const hasNumericFields = safeData.length > 0 && safeData.some(item => {
      try {
        return item && typeof item === 'object' && item !== null && 
               Object.values(item).some(value => typeof value === 'number');
      } catch {
        return false;
      }
    });
    
    return `## AI Insights Analysis (Fallback Mode)

**Data Summary:**
- Data Type: ${dataType}
- Records Analyzed: ${dataCount}
- Data Characteristics: ${hasNumericFields ? 'Contains numeric data' : 'Text-based data'}

**Key Observations:**
- Dataset contains ${dataCount} ${dataType} records
- ${hasNumericFields ? 'Numeric patterns detected in the data' : 'Text-based information available for analysis'}
- Data appears to be structured and ready for analysis

**Recommendations:**
1. **Data Quality**: Ensure all required fields are populated
2. **Regular Updates**: Keep data current for better insights
3. **AI Integration**: Configure OpenAI API key for advanced AI-powered insights
4. **Data Validation**: Implement checks to maintain data integrity

**Next Steps:**
- Set up a valid OpenAI API key to enable AI-powered analysis
- Consider data segmentation for more targeted insights
- Implement regular data refresh cycles

*Note: This is a fallback analysis. For AI-powered insights, please configure your OpenAI API key.*`;
  }
}
