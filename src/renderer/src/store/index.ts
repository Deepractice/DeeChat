import { configureStore } from '@reduxjs/toolkit'
import chatReducer from './slices/chatSlice'
import configReducer from './slices/configSlice'

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    config: configReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
