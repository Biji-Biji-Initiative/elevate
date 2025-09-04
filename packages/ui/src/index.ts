// Export shadcn/ui components
export { Button, buttonVariants } from './components/ui/button'
export type { ButtonProps } from './components/ui/button'
export { Badge, badgeVariants } from './components/ui/badge'
export type { BadgeProps } from './components/ui/badge'
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/ui/card'
export { Input } from './components/ui/input'
export type { InputProps } from './components/ui/input'
export { Label } from './components/ui/label'
export { Textarea } from './components/ui/textarea'
export type { TextareaProps } from './components/ui/textarea'
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
export { cn, hasUploadPath } from './lib/utils'

// Export styles (path only, not module exports)
// For CSS imports, use: import '@elevate/ui/styles/globals.css'

// Export blocks
export * from './blocks/index'

// Export sections
export * from './blocks/sections/index'
