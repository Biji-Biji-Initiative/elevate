// Export shadcn/ui components
export { Button, buttonVariants } from './components/button'
export { Badge, badgeVariants } from './components/badge'
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/card'
export { Input } from './components/input'
export { Label } from './components/label'
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField as ShadcnFormField,
} from './components/form'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './components/table'

// Export utility functions
export { cn } from './lib/utils'

// Export custom components
export { Textarea } from './Textarea'
export { FormField } from './FormField'
export { FileUpload } from './FileUpload'

// Export new shared components
export { LoadingSpinner, LoadingContainer, LoadingOverlay, PageLoading } from './components/LoadingSpinner'
export { DataTable } from './components/DataTable'
export type { DataTableProps, Column } from './components/DataTable'
export { Modal, ConfirmModal } from './components/Modal'
export { StatusBadge } from './components/StatusBadge'
export { StageCard } from './components/StageCard'
export { MetricsChart, StatsGrid } from './components/MetricsChart'
export { ShareButton, SocialShareButtons } from './components/ShareButton'
export { ProfileCard } from './components/ProfileCard'
export { LeaderboardTable } from './components/LeaderboardTable'
export { Header } from './components/Header'
export { Footer } from './components/Footer'
export { AdminLayout } from './components/AdminLayout'
export { LanguageSwitcher } from './components/LanguageSwitcher'

// Export types
export type { FileUploadProps } from './FileUpload'