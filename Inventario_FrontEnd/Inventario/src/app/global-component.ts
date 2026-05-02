import { environment } from '../environments/environment';

const apiBase = environment.apiUrl.replace(/\/+$/, '');

export const GlobalComponent = {
    // Api Calling (misma base que environment.apiUrl)
    API_URL: `${apiBase}/`,
    headerToken: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },

    // Auth Api
    AUTH_API: `${apiBase}/Usuarios/`,


    // Products Api
    product: 'apps/product',
    productDelete: 'apps/product/',

    // Orders Api
    order: 'apps/order',
    orderId: 'apps/order/',

    // Customers Api
    customer: 'apps/customer',
}