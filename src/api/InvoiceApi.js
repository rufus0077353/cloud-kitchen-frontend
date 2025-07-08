import axios from "axios";


const API = process.env.REACT_APP_API_BASE_URL;

const API_URL = `${API}/api/invoices`;

export const fetchInvoices = () => axios.get(API_URL);
export const createInvoice = (invoice) => axios.post(API_URL, invoice);
export const updateInvoice = (id, invoice) => axios.put(`${API_URL}/${id}`, invoice);
export const deleteInvoice = (id) => axios.delete(`${API_URL}/${id}`);
export const getInvoiceById = (id) => axios.get(`${API_URL}/${id}`);