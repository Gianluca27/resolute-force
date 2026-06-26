import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: api.products });
export const useDrop = () => useQuery({ queryKey: ['drop'], queryFn: api.drop });
export const useContent = () => useQuery({ queryKey: ['content'], queryFn: api.content });
