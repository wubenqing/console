export interface QueryRequest {
  type: 'iceberg' | 'lance';
  params: Record<string, any>;
}

export interface QueryResponse {
  status: string;
  query: string;
  result: Record<string, any[]>;
  row_count: number;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  // Get the request body
  const body: QueryRequest = await readBody(event);
  
  // Validate the request
  if (!body || !body.type || !body.params) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body. Expected { type: "iceberg" | "lance", params: {} }'
    });
  }
  
  // Determine the target service URL
  const serviceUrl = config.aiQueryServiceUrl || 'http://172.24.37.159:4008';
  
  try {
    let endpoint: string;
    
    if (body.type === 'iceberg') {
      endpoint = `${serviceUrl}/query/iceberg`;
    } else if (body.type === 'lance') {
      endpoint = `${serviceUrl}/query/lance`;
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query type. Expected "iceberg" or "lance"'
      });
    }
    
    // Make request to the FastAPI service - send params as JSON body instead of query parameters
    const response = await $fetch<QueryResponse>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body.params  // Send params as request body instead of query parameters
    });
    
    return response;
  } catch (error: any) {
    console.error('Error calling AI Query Service:', error);
    
    // Handle different types of errors
    if (error.status) {
      throw createError({
        statusCode: error.status,
        statusMessage: error.message || 'Error from AI Query Service'
      });
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Unable to connect to AI Query Service'
    });
  }
});