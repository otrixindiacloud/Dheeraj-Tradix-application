# LPO PDF Table Data Implementation

## Overview

This implementation provides a comprehensive solution for fetching and displaying LPO (Local Purchase Order) PDF table data with the exact structure requested:

**S/N | Item Description & Specifications | Qty | Unit Rate | Disc % | Disc Amt | Net Total | VAT % | VAT Amt**

## Features Implemented

### 1. API Endpoint (`/api/supplier-lpos/:id/pdf-table-data`)

**Location:** `server/routes/supplier-lpo.ts` (lines 1057-1241)

**Features:**
- ✅ Fetches LPO details and items
- ✅ Calculates all financial values (discounts, VAT, totals)
- ✅ Returns structured data matching PDF table format
- ✅ Comprehensive error handling
- ✅ Detailed logging for debugging
- ✅ Raw data included for reference

**Response Structure:**
```json
{
  "success": true,
  "lpoId": "string",
  "lpoNumber": "string", 
  "currency": "BHD",
  "tableHeaders": ["S/N", "Item Description & Specifications", "Qty", "Unit Rate", "Disc %", "Disc Amt", "Net Total", "VAT %", "VAT Amt"],
  "tableData": [
    {
      "serialNumber": 1,
      "itemDescription": "Item description",
      "quantity": "10",
      "unitRate": "25.000",
      "discountPercent": "5.0",
      "discountAmount": "12.500",
      "netTotal": "237.500",
      "vatPercent": "10.0",
      "vatAmount": "23.750",
      "rawData": { /* additional calculated values */ }
    }
  ],
  "totals": {
    "totalGrossAmount": "250.000",
    "totalDiscountAmount": "12.500", 
    "totalNetAmount": "237.500",
    "totalVatAmount": "23.750",
    "totalAmount": "261.250"
  },
  "lpoDetails": { /* LPO metadata */ },
  "itemCount": 1,
  "generatedAt": "2024-01-27T10:30:00.000Z"
}
```

### 2. Frontend Component (`LpoPdfTable`)

**Location:** `client/src/components/lpo-pdf-table.tsx`

**Features:**
- ✅ Responsive table display with exact PDF structure
- ✅ Real-time data fetching with React Query
- ✅ Loading states and error handling
- ✅ Currency formatting
- ✅ Status badges and visual indicators
- ✅ Totals summary with color coding
- ✅ Debug mode for development
- ✅ Refresh functionality

**Props:**
```typescript
interface LpoPdfTableProps {
  lpoId: string;
  onClose?: () => void;
}
```

### 3. Test Page (`LpoPdfTableTestPage`)

**Location:** `client/src/pages/lpo-pdf-table-test.tsx`
**Route:** `/lpo-pdf-table-test`

**Features:**
- ✅ Manual LPO ID input testing
- ✅ Auto-test with available LPOs
- ✅ Real-time test results display
- ✅ Sample data preview
- ✅ Full component integration test
- ✅ Error scenario testing

### 4. Test Script

**Location:** `test-lpo-pdf-table.js`

**Features:**
- ✅ Command-line testing tool
- ✅ API response validation
- ✅ Structure validation
- ✅ Error handling tests
- ✅ Sample data display

**Usage:**
```bash
node test-lpo-pdf-table.js <LPO_ID>
```

## Data Flow

```
1. User requests LPO PDF table data
   ↓
2. API fetches LPO and items from database
   ↓
3. Financial calculations performed:
   - Gross Amount = Qty × Unit Rate
   - Discount Amount = max(Discount Amount, Gross × Discount %)
   - Net Total = Gross - Discount
   - VAT Amount = max(VAT Amount, Net × VAT %)
   ↓
4. Data formatted into table structure
   ↓
5. Response sent to frontend
   ↓
6. Component renders formatted table
```

## Financial Calculations

The implementation uses the same calculation logic as the PDF generation:

1. **Gross Amount:** `quantity × unitCost`
2. **Discount Amount:** Uses absolute amount if provided, otherwise calculates from percentage
3. **Net Total:** `grossAmount - discountAmount`
4. **VAT Amount:** Uses absolute amount if provided, otherwise calculates from percentage
5. **VAT Percentage:** Calculated as `(vatAmount / netTotal) × 100`

## Error Handling

### API Level
- ✅ LPO not found (404)
- ✅ Invalid LPO ID format
- ✅ Database connection errors
- ✅ Item processing errors
- ✅ Comprehensive logging

### Frontend Level
- ✅ Network errors
- ✅ Invalid responses
- ✅ Loading states
- ✅ User-friendly error messages
- ✅ Retry functionality

## Testing

### Manual Testing
1. Navigate to `/lpo-pdf-table-test`
2. Enter a valid LPO ID
3. Click "Test LPO PDF Table Data"
4. Verify table structure and calculations

### Automated Testing
1. Run the test script: `node test-lpo-pdf-table.js <LPO_ID>`
2. Verify all validation checks pass
3. Review sample data output

### Integration Testing
1. Use the full `LpoPdfTable` component
2. Test with various LPO states (Draft, Sent, Confirmed, etc.)
3. Verify currency formatting
4. Test error scenarios

## Usage Examples

### Basic Usage
```tsx
import LpoPdfTable from '@/components/lpo-pdf-table';

function MyComponent() {
  return <LpoPdfTable lpoId="lpo-123" />;
}
```

### With Close Handler
```tsx
function MyComponent() {
  const [showTable, setShowTable] = useState(false);
  
  return (
    <div>
      <Button onClick={() => setShowTable(true)}>
        View PDF Table Data
      </Button>
      {showTable && (
        <LpoPdfTable 
          lpoId="lpo-123" 
          onClose={() => setShowTable(false)} 
        />
      )}
    </div>
  );
}
```

### API Usage
```javascript
// Fetch PDF table data
const response = await fetch('/api/supplier-lpos/lpo-123/pdf-table-data');
const data = await response.json();

// Access table data
console.log('Headers:', data.tableHeaders);
console.log('Items:', data.tableData);
console.log('Totals:', data.totals);
```

## File Structure

```
├── server/routes/supplier-lpo.ts          # API endpoint implementation
├── client/src/components/lpo-pdf-table.tsx    # Main component
├── client/src/pages/lpo-pdf-table-test.tsx    # Test page
├── client/src/App.tsx                     # Route registration
└── test-lpo-pdf-table.js                  # Test script
```

## Dependencies

### Backend
- Express.js
- Database storage layer
- Financial calculation utilities

### Frontend  
- React
- React Query (TanStack Query)
- Tailwind CSS
- Lucide React icons
- Custom UI components

## Performance Considerations

- ✅ React Query caching (30-second stale time)
- ✅ Efficient data processing
- ✅ Minimal re-renders
- ✅ Lazy loading support
- ✅ Error boundaries

## Security

- ✅ Input validation
- ✅ SQL injection prevention
- ✅ Error message sanitization
- ✅ Authentication required

## Future Enhancements

- [ ] Export to Excel/CSV
- [ ] Print functionality
- [ ] Bulk operations
- [ ] Advanced filtering
- [ ] Real-time updates
- [ ] PDF preview integration

## Troubleshooting

### Common Issues

1. **No data returned:** Check if LPO exists and has items
2. **Calculation errors:** Verify item data integrity
3. **Currency formatting:** Ensure currency field is set
4. **Network errors:** Check API endpoint availability

### Debug Mode

Enable debug mode by setting `NODE_ENV=development` to see:
- Raw API responses
- Calculation details
- Error stack traces
- Performance metrics

## Conclusion

This implementation provides a complete solution for fetching and displaying LPO PDF table data with the exact structure requested. The solution includes comprehensive error handling, testing capabilities, and a user-friendly interface for both development and production use.
