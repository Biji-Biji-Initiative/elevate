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

// Export custom components (legacy)
export { Card as LegacyCard } from '../Card'
export { Input as LegacyInput } from '../Input'
export { Textarea } from '../Textarea'
export { FormField } from '../FormField'
export { FileUpload } from '../FileUpload'
export { Alert } from '../Alert'
export { LoadingSpinner, LoadingContainer, LoadingOverlay } from '../LoadingSpinner'

// Export types
export type { FileUploadProps } from '../FileUpload'