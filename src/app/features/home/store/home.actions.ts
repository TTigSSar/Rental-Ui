import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type { HomeSectionResponse } from '../models/home-section.model';

export const HomeSectionsActions = createActionGroup({
  source: 'Home Sections',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ sections: HomeSectionResponse[] }>(),
    'Load Failure': props<{ error: string }>(),
  },
});
