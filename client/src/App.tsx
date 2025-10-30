import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AIProvider } from "@/components/ai-assistant/ai-context";
import { NotificationProvider } from "@/components/notifications/notification-context";
import NotFound from "@/pages/not-found";
import ItemsPage from "@/pages/items";
import Dashboard from "@/pages/dashboard";
import AIDemoPage from "@/pages/ai-demo";
import Enquiries from "@/pages/enquiries";
import EnquiryDetail from "@/pages/enquiry-detail";
import Quotations from "@/pages/quotations";
import QuotationDetailPage from "@/pages/quotation-detail";
import QuotationNewPage from "@/pages/quotation-new";
import CustomerAcceptance from "@/pages/customer-acceptance";
import CustomerPoUpload from "@/pages/customer-po-upload";
import SalesOrders from "@/pages/sales-orders";
import SalesOrderDetail from "@/pages/sales-order-detail";
import SupplierLpo from "@/pages/supplier-lpo";
import LpoDetail from "@/pages/lpo-detail";
import GoodsReceipt from "@/pages/goods-receipt";
import Inventory from "@/pages/inventory";
import InventoryManagement from "@/pages/inventory-management";
import InventoryItemDetail from "@/pages/inventory-item-detail";
import PhysicalStock from "@/pages/physical-stock";
import PhysicalStockDetailPage from "@/pages/physical-stock-detail";
import DeliveryManagement from "@/pages/delivery-management";
import Delivery from "@/pages/delivery";
import Invoicing from "@/pages/invoicing";
import PricingManagement from "@/pages/pricing-management";
import MainLayout from "@/components/layout/main-layout";
import { AuthProvider, useAuth } from "@/components/auth/auth-context";
import LoginPage from "@/pages/login";
import Suppliers from "@/pages/suppliers";
import SupplierDetail from "@/pages/supplier-detail";
import Carriers from "@/pages/carriers";
import CarrierDetail from "@/pages/carrier-detail";
import Notifications from "@/pages/notifications";
import RecentActivities from "@/pages/recent-activities";
import AuditLogs from "@/pages/audit-logs";
import UserManagement from "@/pages/user-management";
import SystemSettings from "@/pages/system-settings";
import Analytics from "@/pages/analytics";
import ExportData from "@/pages/export-data";
import TallyIntegration from "@/pages/tally-integration";
import CustomerManagement from "@/pages/customer-management";
import CustomerDetail from "@/pages/customer-detail";
import DeliveryNote from "@/pages/delivery-note";
import DeliveryNoteDetail from "@/pages/delivery-note-detail";
import NotificationSettings from "@/pages/notification-settings";
import BlueThemeTest from "@/pages/blue-theme-test";
import ProcessFlowDetails from "@/pages/process-flow-details";
import WorkflowDashboard from "@/pages/workflow-dashboard";
import MaterialReceiptDetail from "@/pages/material-receipt-detail";
import Workflow from "@/pages/workflow";
import Requisitions from "@/pages/requisitions";
import RequisitionDetail from "@/pages/requisition-detail";
import SupplierQuotes from "@/pages/supplier-quotes";
import SupplierQuoteDetail from "@/pages/supplier-quote-detail";
import ShipmentTracking from "@/pages/shipment-tracking";
import ShipmentDetailPage from "@/pages/shipment-detail";
import ShipmentCreateLPO from "@/pages/shipment-create-lpo";
import PurchaseInvoices from "@/pages/purchase-invoices";
import PurchaseInvoiceDetail from "@/pages/purchase-invoice-detail";
import InvoiceDetailPage from "@/pages/invoice-detail-page";
import MaterialRequestsPage from "@/pages/material-requests";
import MaterialRequestDetail from "@/pages/material-request-detail";
import ReceiptsPage from "@/pages/receipts";
import ReceiptDetail from "@/pages/receipt-detail";
import StockIssuesPage from "@/pages/stock-issues";
import MaterialIssueDetail from "@/pages/material-issue-detail";
import ReceiptReturnsPage from "@/pages/receipt-returns";
import ReturnDetail from "@/pages/return-detail";
import StockTransferPage from "@/pages/stock-transfer";
import StockTransferDetailPage from "@/pages/stock-transfer-detail";
import StandaloneInvoice from "@/pages/standalone-invoice";
import IssueReturnPage from "@/pages/issue-return";
import IssueReturnDetailPage from "@/pages/issue-return-detail";
import AccessManagement from "@/pages/access-management";
import RoleManagement from "@/pages/role-management";
import PermissionManagement from "@/pages/permission-management";
import LpoPdfTableTestPage from "@/pages/lpo-pdf-table-test";

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }
  if (!user) {
    return <LoginPage />;
  }
  return (
    <MainLayout>
      <ErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/login" component={LoginPage} />
          <Route path="/ai-demo" component={AIDemoPage} />
          <Route path="/enquiries" component={Enquiries} />
          <Route path="/enquiries/:id" component={EnquiryDetail} />
          <Route path="/workflow-dashboard" component={WorkflowDashboard} />
          <Route path="/workflow" component={Workflow} />
          <Route path="/quotations" component={Quotations} />
          <Route path="/quotations/new" component={QuotationNewPage} />
          <Route path="/quotations/:id" component={QuotationDetailPage} />
          <Route path="/quotations/:id/acceptance" component={CustomerAcceptance} />
          <Route path="/customer-po-upload" component={CustomerPoUpload} />
          <Route path="/sales-orders" component={SalesOrders} />
          <Route path="/sales-orders/:id" component={SalesOrderDetail} />
          <Route path="/delivery-note" component={DeliveryNote} />
          <Route path="/delivery-note/:id" component={DeliveryNoteDetail} />
          <Route path="/supplier-lpo" component={SupplierLpo} />
          <Route path="/supplier-lpo/:id" component={LpoDetail} />
          <Route path="/goods-receipt" component={GoodsReceipt} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/inventory-management" component={InventoryManagement} />
          <Route path="/physical-stock" component={PhysicalStock} />
          <Route path="/physical-stock/:id" component={PhysicalStockDetailPage} />
          <Route path="/items" component={ItemsPage} />
          <Route path="/delivery" component={Delivery} />
          <Route path="/delivery-management" component={DeliveryManagement} />
          <Route path="/invoicing" component={Invoicing} />
          <Route path="/pricing" component={PricingManagement} />
          <Route path="/suppliers" component={Suppliers} />
          <Route path="/suppliers/:id" component={SupplierDetail} />
          <Route path="/carriers" component={Carriers} />
          <Route path="/carriers/:id" component={CarrierDetail} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/recent-activities" component={RecentActivities} />
          <Route path="/audit-logs" component={AuditLogs} />
          <Route path="/user-management" component={UserManagement} />
          <Route path="/system-settings" component={SystemSettings} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/export-data" component={ExportData} />
          <Route path="/tally-integration" component={TallyIntegration} />
          <Route path="/customer-management" component={CustomerManagement} />
          <Route path="/customers/:id" component={CustomerDetail} />
          <Route path="/notification-settings" component={NotificationSettings} />
          <Route path="/blue-theme-test" component={BlueThemeTest} />
          <Route path="/process-flow-details" component={ProcessFlowDetails} />
          <Route path="/requisitions" component={Requisitions} />
          <Route path="/requisitions/:id" component={RequisitionDetail} />
          <Route path="/material-requests" component={MaterialRequestsPage} />
          <Route path="/material-requests/:id" component={MaterialRequestDetail} />
          <Route path="/inventory-items/:id" component={InventoryItemDetail} />
          <Route path="/receipts" component={ReceiptsPage} />
          <Route path="/receipts/:id" component={ReceiptDetail} />
          <Route path="/material-receipt/:id" component={MaterialReceiptDetail} />
          <Route path="/stock-issues" component={StockIssuesPage} />
          <Route path="/material-issue/:id" component={MaterialIssueDetail} />
          <Route path="/receipt-returns" component={ReceiptReturnsPage} />
          <Route path="/receipt-returns/:id" component={ReturnDetail} />
          <Route path="/stock-transfer" component={StockTransferPage} />
          <Route path="/stock-transfer/:id" component={StockTransferDetailPage} />
          <Route path="/supplier-quotes" component={SupplierQuotes} />
          <Route path="/supplier-quotes/:id" component={SupplierQuoteDetail} />
          <Route path="/shipment-tracking" component={ShipmentTracking} />
          <Route path="/shipment-tracking/:id" component={ShipmentDetailPage} />
          <Route path="/shipment-create-lpo" component={ShipmentCreateLPO} />
          <Route path="/purchase-invoices" component={PurchaseInvoices} />
          <Route path="/purchase-invoices/:id" component={PurchaseInvoiceDetail} />
          <Route path="/invoices/:id" component={InvoiceDetailPage} />
          <Route path="/standalone-invoice" component={StandaloneInvoice} />
          <Route path="/issue-return" component={IssueReturnPage} />
          <Route path="/issue-return/:id" component={IssueReturnDetailPage} />
          <Route path="/access-management" component={AccessManagement} />
          <Route path="/role-management" component={RoleManagement} />
          <Route path="/permission-management" component={PermissionManagement} />
          <Route path="/lpo-pdf-table-test" component={LpoPdfTableTestPage} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationProvider>
          <AIProvider>
            <Toaster />
            <AuthProvider>
              <ProtectedRoutes />
            </AuthProvider>
          </AIProvider>
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
