import { storage } from './server/storage/index.ts';

async function createTestLPOAndShipment() {
  try {
    console.log('Creating test LPO and shipment data...');

    // First, create a supplier if it doesn't exist
    let supplier = await storage.getSuppliers({ search: 'qube electic vehicle' });
    if (!supplier || supplier.length === 0) {
      console.log('Creating supplier: qube electic vehicle');
      supplier = await storage.createSupplier({
        name: 'qube electic vehicle',
        email: 'contact@qubeelectric.com',
        phone: '+973-1234-5678',
        address: '123 Electric Avenue, Manama, Bahrain',
        isActive: true,
        supplierType: 'Manufacturer',
        paymentTerms: 'Net 30',
        currency: 'BHD'
      });
    } else {
      supplier = supplier[0];
    }

    console.log('Supplier ID:', supplier.id);

    // Create LPO with the specified items
    const lpoData = {
      supplierId: supplier.id,
      lpoNumber: 'LPO-9423298FWA',
      lpoDate: new Date(),
      expectedDeliveryDate: new Date('2025-10-31'),
      subtotal: '38541.56',
      taxAmount: '0.00',
      totalAmount: '38541.56',
      currency: 'BHD',
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOB Destination',
      specialInstructions: 'Handle with care - electric vehicle components',
      status: 'Confirmed'
    };

    console.log('Creating LPO:', lpoData.lpoNumber);
    const lpo = await storage.createSupplierLpo(lpoData);

    // Create LPO items
    const lpoItems = [
      {
        supplierLpoId: lpo.id,
        itemDescription: 'drum',
        quantity: 1568,
        unitCost: '8.00',
        totalCost: '12544.00',
        unitOfMeasure: 'pcs',
        specialInstructions: 'Electric vehicle drum component'
      },
      {
        supplierLpoId: lpo.id,
        itemDescription: 'clock',
        quantity: 157,
        unitCost: '56.00',
        totalCost: '8792.00',
        unitOfMeasure: 'pcs',
        specialInstructions: 'Digital clock for dashboard'
      },
      {
        supplierLpoId: lpo.id,
        itemDescription: 'bed',
        quantity: 153,
        unitCost: '85.00',
        totalCost: '13005.00',
        unitOfMeasure: 'pcs',
        specialInstructions: 'Vehicle bed component'
      }
    ];

    console.log('Creating LPO items...');
    for (const item of lpoItems) {
      await storage.createSupplierLpoItem(item);
    }

    // Create shipment from LPO
    const shipmentData = {
      shipmentNumber: 'SH-2024-LPO-001',
      trackingNumber: 'TRK-LPO-9423298FWA',
      lpoId: lpo.id,
      lpoNumber: lpo.lpoNumber,
      carrierId: supplier.id, // Using supplier as carrier for test
      carrierName: 'DHL Express',
      serviceType: 'Express',
      priority: 'High',
      origin: 'Warehouse A, Manama',
      destination: 'Customer Location, Bahrain',
      estimatedDelivery: new Date('2025-10-31'),
      weight: '250.5 kg',
      dimensions: '120x80x60 cm',
      declaredValue: '38541.56',
      currency: 'BHD',
      shippingCost: '150.00',
      specialInstructions: 'Handle electric vehicle components with care',
      packageCount: 3,
      isInsured: true,
      requiresSignature: true,
      currentLocation: 'Origin Facility',
      lastUpdate: new Date(),
      items: [
        {
          itemDescription: 'drum',
          quantity: 1568,
          deliveredQuantity: 0,
          unitCost: '8.00',
          totalCost: '12544.00',
          unitOfMeasure: 'pcs',
          specialInstructions: 'Electric vehicle drum component',
          deliveryStatus: 'Pending'
        },
        {
          itemDescription: 'clock',
          quantity: 157,
          deliveredQuantity: 0,
          unitCost: '56.00',
          totalCost: '8792.00',
          unitOfMeasure: 'pcs',
          specialInstructions: 'Digital clock for dashboard',
          deliveryStatus: 'Pending'
        },
        {
          itemDescription: 'bed',
          quantity: 153,
          deliveredQuantity: 0,
          unitCost: '85.00',
          totalCost: '13005.00',
          unitOfMeasure: 'pcs',
          specialInstructions: 'Vehicle bed component',
          deliveryStatus: 'Pending'
        }
      ],
      subtotal: '38541.56',
      taxAmount: '0.00',
      totalAmount: '38541.56',
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOB Destination'
    };

    console.log('Creating shipment:', shipmentData.shipmentNumber);
    const shipment = await storage.createShipment(shipmentData);

    console.log('Test data created successfully!');
    console.log('LPO ID:', lpo.id);
    console.log('Shipment ID:', shipment.id);
    console.log('LPO Number:', lpo.lpoNumber);
    console.log('Shipment Number:', shipment.shipmentNumber);

    return { lpo, shipment };

  } catch (error) {
    console.error('Error creating test data:', error);
    throw error;
  }
}

// Run the script
createTestLPOAndShipment()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
