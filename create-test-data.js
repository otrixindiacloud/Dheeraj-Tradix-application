// Test script to create LPO and shipment data via API
const API_BASE = 'http://localhost:5000';

async function createTestData() {
  try {
    console.log('Creating test LPO and shipment data...');

    // First, create a supplier
    const supplierData = {
      name: 'qube electic vehicle',
      email: 'contact@qubeelectric.com',
      phone: '+973-1234-5678',
      address: '123 Electric Avenue, Manama, Bahrain',
      isActive: true,
      supplierType: 'Manufacturer',
      paymentTerms: 'Net 30',
      currency: 'BHD'
    };

    console.log('Creating supplier...');
    const supplierResponse = await fetch(`${API_BASE}/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplierData)
    });

    if (!supplierResponse.ok) {
      const error = await supplierResponse.text();
      console.log('Supplier creation response:', error);
      // Try to get existing supplier
      const existingSuppliers = await fetch(`${API_BASE}/api/suppliers?search=qube`);
      const suppliers = await existingSuppliers.json();
      if (suppliers && suppliers.length > 0) {
        var supplier = suppliers[0];
        console.log('Using existing supplier:', supplier.id);
      } else {
        throw new Error('Could not create or find supplier');
      }
    } else {
      var supplier = await supplierResponse.json();
      console.log('Created supplier:', supplier.id);
    }

    // Create LPO
    const lpoData = {
      supplierId: supplier.id,
      lpoNumber: 'LPO-9423298FWA',
      lpoDate: new Date().toISOString(),
      expectedDeliveryDate: new Date('2025-10-31').toISOString(),
      subtotal: '38541.56',
      taxAmount: '0.00',
      totalAmount: '38541.56',
      currency: 'BHD',
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOB Destination',
      specialInstructions: 'Handle with care - electric vehicle components',
      status: 'Confirmed'
    };

    console.log('Creating LPO...');
    const lpoResponse = await fetch(`${API_BASE}/api/supplier-lpos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lpoData)
    });

    if (!lpoResponse.ok) {
      const error = await lpoResponse.text();
      console.log('LPO creation error:', error);
      throw new Error('Failed to create LPO');
    }

    const lpo = await lpoResponse.json();
    console.log('Created LPO:', lpo.id);

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
      const itemResponse = await fetch(`${API_BASE}/api/supplier-lpo-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });

      if (!itemResponse.ok) {
        const error = await itemResponse.text();
        console.log('Item creation error:', error);
      } else {
        console.log('Created item:', item.itemDescription);
      }
    }

    // Create shipment
    const shipmentData = {
      shipmentNumber: 'SH-2024-LPO-001',
      trackingNumber: 'TRK-LPO-9423298FWA',
      lpoId: lpo.id,
      lpoNumber: lpo.lpoNumber,
      carrierId: supplier.id,
      carrierName: 'DHL Express',
      serviceType: 'Express',
      priority: 'High',
      origin: 'Warehouse A, Manama',
      destination: 'Customer Location, Bahrain',
      estimatedDelivery: new Date('2025-10-31').toISOString(),
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
      lastUpdate: new Date().toISOString(),
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

    console.log('Creating shipment...');
    const shipmentResponse = await fetch(`${API_BASE}/api/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipmentData)
    });

    if (!shipmentResponse.ok) {
      const error = await shipmentResponse.text();
      console.log('Shipment creation error:', error);
      throw new Error('Failed to create shipment');
    }

    const shipment = await shipmentResponse.json();
    console.log('Created shipment:', shipment.id);

    console.log('Test data created successfully!');
    console.log('LPO Number:', lpo.lpoNumber);
    console.log('Shipment Number:', shipment.shipmentNumber);
    console.log('Total Value: BHD 38,541.56');
    console.log('Expected Delivery: 31/10/2025');
    console.log('Items Count: 3 items');

    return { lpo, shipment };

  } catch (error) {
    console.error('Error creating test data:', error);
    throw error;
  }
}

// Run the script
createTestData()
  .then(() => {
    console.log('Script completed successfully');
  })
  .catch((error) => {
    console.error('Script failed:', error);
  });
