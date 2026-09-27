type Characteristic = readonly [label: string, value: string]

// Presentation details for the fixed demo catalog, limited to facts stated by its seed data.
const characteristicsByProductId: Record<string, readonly Characteristic[]> = {
  '8a52ea31-08d9-4f52-a604-00e56143dce0': [
    ['Tipo', 'Audífonos de diadema'],
    ['Conexión', 'Inalámbrica'],
    ['Color', 'Negro'],
  ],
  '3685f095-a601-4ca6-ab54-0f8eb66bccd8': [
    ['Tipo', 'Parlante portátil'],
    ['Conexión', 'Bluetooth'],
    ['Formato', 'Compacto'],
  ],
  '9b135df6-299a-43c1-a33f-6f3a0fc9281a': [
    ['Tipo', 'Mochila urbana'],
    ['Color', 'Negro'],
  ],
  'ee4216cd-55e7-42c1-9c25-398c385955ad': [
    ['Tipo', 'Billetera compacta'],
    ['Material', 'Cuero'],
    ['Color', 'Marrón'],
  ],
  'aa6cc46a-7dd1-4f36-a884-8e75088851b9': [
    ['Tipo', 'Termo de viaje'],
    ['Material', 'Acero'],
    ['Acabado', 'Oscuro'],
  ],
  '79e9bec3-9a34-43fe-a5d4-b11e22f20f89': [
    ['Tipo', 'Ratón inalámbrico'],
    ['Color', 'Gris grafito'],
    ['Formato', 'Compacto'],
  ],
  '19777d45-8fe4-4a48-ba25-ff41b30c5816': [
    ['Tipo', 'Lámpara de escritorio'],
    ['Iluminación', 'LED'],
    ['Color', 'Negro'],
  ],
  '934c2c27-f973-43a1-b6e1-3feb06800c0c': [
    ['Tipo', 'Teclado mecánico compacto'],
    ['Color', 'Gris oscuro'],
  ],
  '2f5bea3c-9169-4172-a395-6afa0448009a': [
    ['Tipo', 'Batería externa portátil'],
    ['Color', 'Negro'],
  ],
  '14746114-cb12-446c-8386-3c7bce2bd966': [
    ['Tipo', 'Soporte para teléfono'],
    ['Diseño', 'Plegable'],
    ['Color', 'Gris'],
  ],
}

export function getProductCharacteristics(productId: string): readonly Characteristic[] {
  return characteristicsByProductId[productId] ?? []
}
