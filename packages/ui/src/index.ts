// Export shadcn/ui components
export { Button, buttonVariants } from './components/ui/button.js'
export { Badge, badgeVariants } from './components/ui/badge.js'
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/ui/card.js'
export { Input } from './components/ui/input.js'
export { Label } from './components/ui/label.js'
export { Textarea } from './components/ui/textarea.js'
export { Alert, AlertTitle, AlertDescription } from './components/ui/alert.js'
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog.js'
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './components/ui/select.js'
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField as ShadcnFormField,
} from './components/ui/form.js'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './components/ui/table.js'

// Export utility functions
export { cn, hasUploadPath } from './lib/utils.js'

// Export custom components
export { FormField } from './FormField.js'
export { FileUpload, FileList } from './FileUpload.js'
export type { UploadedFile } from './FileUpload.js'

// Export new shared components
export { LoadingSpinner, LoadingContainer, LoadingOverlay, PageLoading } from './components/LoadingSpinner.js'
export { DataTable, createColumns } from './components/DataTable.js'
export type { DataTableProps, Column, ColumnOf } from './components/DataTable.js'
export { Modal, ConfirmModal } from './components/Modal.js'
export { StatusBadge } from './components/StatusBadge.js'
export { StageCard } from './components/StageCard.js'
export { MetricsChart, StatsGrid } from './components/MetricsChart.js'
export { ShareButton, SocialShareButtons } from './components/ShareButton.js'
export { ProfileCard } from './components/ProfileCard.js'
export { LeaderboardTable } from './components/LeaderboardTable.js'
export { Header } from './components/Header.js'
export { ClientHeader } from './components/ClientHeader.js'
export { Footer } from './components/Footer.js'
export { AdminLayout } from './components/AdminLayout.js'
export { LanguageSwitcher } from './components/LanguageSwitcher.js'

// Export types
export type { FileUploadProps } from './FileUpload.js'
