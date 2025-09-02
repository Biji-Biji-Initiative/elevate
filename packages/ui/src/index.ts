// Export shadcn/ui components
export { Button, buttonVariants } from './components/ui/button'
export { Badge, badgeVariants } from './components/ui/badge'
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/ui/card'
export { Input } from './components/ui/input'
export { Label } from './components/ui/label'
export { Textarea } from './components/ui/textarea'
export { Alert, AlertTitle, AlertDescription } from './components/ui/alert'
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
} from './components/ui/dialog'
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
} from './components/ui/select'
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField as ShadcnFormField,
} from './components/ui/form'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './components/ui/table'

// Export utility functions
export { cn } from './lib/utils'

// Export custom components
export { FormField } from '../FormField'
export { FileUpload } from '../FileUpload'

// Export new shared components
export { LoadingSpinner, LoadingContainer, LoadingOverlay, PageLoading } from '../components/LoadingSpinner'
export { DataTable } from '../components/DataTable'
export type { DataTableProps, Column } from '../components/DataTable'
export { Modal, ConfirmModal } from '../components/Modal'
export { StatusBadge } from '../components/StatusBadge'
export { StageCard } from '../components/StageCard'
export { MetricsChart, StatsGrid } from '../components/MetricsChart'
export { ShareButton, SocialShareButtons } from '../components/ShareButton'
export { ProfileCard } from '../components/ProfileCard'
export { LeaderboardTable } from '../components/LeaderboardTable'
export { Header } from '../components/Header'
export { ClientHeader } from '../components/ClientHeader'
export { Footer } from '../components/Footer'
export { AdminLayout } from '../components/AdminLayout'
export { LanguageSwitcher } from '../components/LanguageSwitcher'

// Export types
export type { FileUploadProps } from '../FileUpload'