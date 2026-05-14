import type { HomeSectionResponse } from '../models/home-section.model';

export interface HomeState {
  readonly sections: HomeSectionResponse[];
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialHomeState: HomeState = {
  sections: [],
  loading: false,
  error: null,
};
