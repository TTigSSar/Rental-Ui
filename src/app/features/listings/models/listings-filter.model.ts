export interface ListingsFilter {
  query: string | null;
  city: string | null;
  categoryId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
}
