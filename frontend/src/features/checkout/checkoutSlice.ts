import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { ApiError, getProduct, getQuote } from '../../api/checkoutApi'
import type { CheckoutQuote, Product } from '../../api/checkoutApi'

// This is the seeded product used by the single-product checkout, not a catalog.
export const CHECKOUT_PRODUCT_ID = '8a52ea31-08d9-4f52-a604-00e56143dce0'

type RequestStatus = 'idle' | 'loading' | 'ready' | 'error'
type CheckoutStep = 'product' | 'card'

interface CheckoutState {
  step: CheckoutStep
  productId: string
  quantity: number
  product: Product | null
  productStatus: RequestStatus
  productError: string | null
  productRequestId: string | null
  quote: CheckoutQuote | null
  quoteStatus: RequestStatus
  quoteError: string | null
  quoteRequestId: string | null
}

const initialState: CheckoutState = {
  step: 'product',
  productId: CHECKOUT_PRODUCT_ID,
  quantity: 1,
  product: null,
  productStatus: 'idle',
  productError: null,
  productRequestId: null,
  quote: null,
  quoteStatus: 'idle',
  quoteError: null,
  quoteRequestId: null,
}

function safeProductError(error: unknown): string {
  if (error instanceof ApiError && error.status === 404)
    return 'Este producto no está disponible.'
  return 'No pudimos cargar el producto. Vuelve a intentarlo.'
}

function safeQuoteError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'Esta cantidad ya no está disponible. Actualiza el producto para continuar.'
  }
  return 'No pudimos calcular tu pedido. Vuelve a intentarlo.'
}

export const loadProduct = createAsyncThunk<
  Product,
  string,
  { rejectValue: string }
>('checkout/productLoaded', async (productId, { signal, rejectWithValue }) => {
  try {
    return await getProduct(productId, signal)
  } catch (error) {
    if (signal.aborted) throw error
    return rejectWithValue(safeProductError(error))
  }
})

export const loadQuote = createAsyncThunk<
  CheckoutQuote,
  { productId: string; quantity: number },
  { rejectValue: string }
>(
  'checkout/quoteLoaded',
  async ({ productId, quantity }, { signal, rejectWithValue }) => {
    try {
      return await getQuote(productId, quantity, signal)
    } catch (error) {
      if (signal.aborted) throw error
      return rejectWithValue(safeQuoteError(error))
    }
  },
)

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    quantityChanged(state, action: PayloadAction<number>) {
      if (!Number.isSafeInteger(action.payload) || action.payload < 1) return
      if (state.product && action.payload > state.product.stock) return
      state.quantity = action.payload
      state.quote = null
      state.quoteStatus = 'idle'
      state.quoteError = null
      state.quoteRequestId = null
    },
    cardEntryRequested(state) {
      if (
        state.productStatus === 'ready' &&
        state.product &&
        state.product.stock >= state.quantity &&
        state.quoteStatus === 'ready' &&
        state.quote?.quantity === state.quantity
      ) {
        state.step = 'card'
      }
    },
    productReturnRequested(state) {
      state.step = 'product'
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadProduct.pending, (state, action) => {
        state.productStatus = 'loading'
        state.productError = null
        state.productRequestId = action.meta.requestId
        state.quote = null
        state.quoteStatus = 'idle'
        state.quoteError = null
        state.quoteRequestId = null
      })
      .addCase(loadProduct.fulfilled, (state, action) => {
        if (state.productRequestId !== action.meta.requestId) return
        state.product = action.payload
        state.productStatus = 'ready'
        state.productRequestId = null
        if (action.payload.stock > 0 && state.quantity > action.payload.stock) {
          state.quantity = action.payload.stock
        }
        state.quote = null
        state.quoteStatus = 'idle'
        state.quoteError = null
        state.quoteRequestId = null
      })
      .addCase(loadProduct.rejected, (state, action) => {
        if (state.productRequestId !== action.meta.requestId) return
        state.productRequestId = null
        if (action.meta.aborted) {
          state.productStatus = state.product ? 'ready' : 'idle'
          return
        }
        state.productStatus = 'error'
        state.productError =
          action.payload ?? 'No pudimos cargar el producto. Vuelve a intentarlo.'
      })
      .addCase(loadQuote.pending, (state, action) => {
        state.quoteStatus = 'loading'
        state.quoteError = null
        state.quoteRequestId = action.meta.requestId
      })
      .addCase(loadQuote.fulfilled, (state, action) => {
        if (state.quoteRequestId !== action.meta.requestId) return
        if (action.payload.quantity !== state.quantity) return
        state.quote = action.payload
        state.quoteStatus = 'ready'
        state.quoteRequestId = null
      })
      .addCase(loadQuote.rejected, (state, action) => {
        if (state.quoteRequestId !== action.meta.requestId) return
        state.quoteRequestId = null
        if (action.meta.aborted) {
          state.quoteStatus = 'idle'
          return
        }
        state.quoteStatus = 'error'
        state.quoteError =
          action.payload ??
          'No pudimos calcular tu pedido. Vuelve a intentarlo.'
      })
  },
})

export const { quantityChanged, cardEntryRequested, productReturnRequested } =
  checkoutSlice.actions
export default checkoutSlice.reducer
