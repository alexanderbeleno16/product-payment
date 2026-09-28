import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { ApiError, getProduct, getProducts, getQuote } from '../../api/checkoutApi'
import type { CheckoutQuote, Product } from '../../api/checkoutApi'

type RequestStatus = 'idle' | 'loading' | 'ready' | 'error'
type CheckoutStep = 'catalog' | 'product' | 'card' | 'summary'

interface CheckoutState {
  step: CheckoutStep
  catalog: Product[]
  catalogStatus: RequestStatus
  catalogError: string | null
  catalogRequestId: string | null
  productId: string | null
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
  step: 'catalog',
  catalog: [],
  catalogStatus: 'idle',
  catalogError: null,
  catalogRequestId: null,
  productId: null,
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

function safeCatalogError(): string {
  return 'No pudimos cargar los productos. Vuelve a intentarlo.'
}

function safeQuoteError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'Esta cantidad ya no está disponible. Actualiza el producto para continuar.'
  }
  return 'No pudimos calcular tu pedido. Vuelve a intentarlo.'
}

export const loadCatalog = createAsyncThunk<
  Product[],
  void,
  { rejectValue: string }
>('checkout/catalogLoaded', async (_, { signal, rejectWithValue }) => {
  try {
    return await getProducts(signal)
  } catch (error) {
    if (signal.aborted) throw error
    return rejectWithValue(safeCatalogError())
  }
})

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
    progressRestored(state, action: PayloadAction<{ productId: string; quantity: number; step?: 'card' }>) {
      state.step = action.payload.step ?? 'product'
      state.productId = action.payload.productId
      state.quantity = action.payload.quantity
    },
    productSelected(state, action: PayloadAction<string>) {
      if (!state.catalog.some((product) => product.id === action.payload)) return
      state.step = 'product'
      state.productId = action.payload
      state.quantity = 1
      state.product = null
      state.productStatus = 'idle'
      state.productError = null
      state.productRequestId = null
      state.quote = null
      state.quoteStatus = 'idle'
      state.quoteError = null
      state.quoteRequestId = null
    },
    catalogReturnRequested(state) {
      state.step = 'catalog'
      state.productId = null
      state.quantity = 1
      state.product = null
      state.productStatus = 'idle'
      state.productError = null
      state.productRequestId = null
      state.quote = null
      state.quoteStatus = 'idle'
      state.quoteError = null
      state.quoteRequestId = null
    },
    quantityChanged(state, action: PayloadAction<number>) {
      if (state.step !== 'product' || state.product?.id !== state.productId)
        return
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
        state.product.id === state.productId &&
        state.product.stock >= state.quantity &&
        state.quoteStatus === 'ready' &&
        state.quote?.productId === state.productId &&
        state.quote?.quantity === state.quantity
      ) {
        state.step = 'card'
      }
    },
    productReturnRequested(state) {
      state.step = 'product'
    },
    summaryEntered(state) {
      if (state.step !== 'card' || state.quoteStatus !== 'ready' ||
        state.quote?.productId !== state.productId ||
        state.quote.quantity !== state.quantity) return
      state.step = 'summary'
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadCatalog.pending, (state, action) => {
        state.catalogStatus = 'loading'
        state.catalogError = null
        state.catalogRequestId = action.meta.requestId
      })
      .addCase(loadCatalog.fulfilled, (state, action) => {
        if (state.catalogRequestId !== action.meta.requestId) return
        state.catalog = action.payload
        state.catalogStatus = 'ready'
        state.catalogRequestId = null
      })
      .addCase(loadCatalog.rejected, (state, action) => {
        if (state.catalogRequestId !== action.meta.requestId) return
        state.catalogRequestId = null
        if (action.meta.aborted) {
          state.catalogStatus = state.catalog.length > 0 ? 'ready' : 'idle'
          return
        }
        state.catalogStatus = 'error'
        state.catalogError = action.payload ?? safeCatalogError()
      })
      .addCase(loadProduct.pending, (state, action) => {
        if (!['product', 'card'].includes(state.step) || state.productId !== action.meta.arg)
          return
        state.productStatus = 'loading'
        state.productError = null
        state.productRequestId = action.meta.requestId
        state.quote = null
        state.quoteStatus = 'idle'
        state.quoteError = null
        state.quoteRequestId = null
      })
      .addCase(loadProduct.fulfilled, (state, action) => {
        if (
          state.productRequestId !== action.meta.requestId ||
          state.productId !== action.meta.arg ||
          action.payload.id !== state.productId
        ) return
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
        if (
          state.productRequestId !== action.meta.requestId ||
          state.productId !== action.meta.arg
        ) return
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
        if (
          !['product', 'card'].includes(state.step) ||
          state.productId !== action.meta.arg.productId ||
          state.product?.id !== state.productId
        ) return
        state.quoteStatus = 'loading'
        state.quoteError = null
        state.quoteRequestId = action.meta.requestId
      })
      .addCase(loadQuote.fulfilled, (state, action) => {
        if (state.quoteRequestId !== action.meta.requestId) return
        if (
          action.meta.arg.productId !== state.productId ||
          action.payload.productId !== state.productId ||
          action.payload.quantity !== state.quantity ||
          action.meta.arg.quantity !== state.quantity
        ) return
        state.quote = action.payload
        state.quoteStatus = 'ready'
        state.quoteRequestId = null
      })
      .addCase(loadQuote.rejected, (state, action) => {
        if (
          state.quoteRequestId !== action.meta.requestId ||
          action.meta.arg.productId !== state.productId
        ) return
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

export const {
  progressRestored,
  productSelected,
  catalogReturnRequested,
  quantityChanged,
  cardEntryRequested,
  productReturnRequested,
  summaryEntered,
} = checkoutSlice.actions
export default checkoutSlice.reducer
