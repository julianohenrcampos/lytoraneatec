import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, Globe, Settings, Eye, EyeOff, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { createGestor, PERMISSION_CATEGORIES, getAllPermissions } from "@/services/gestorService";
import { usePermission } from "@/hooks/usePermission";

interface CreateGestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateGestorModal: React.FC<CreateGestorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { hasActionPermission } = usePermission();
  const canSubmit = hasActionPermission("admin_permissoes_view", "criar");
  
  // Form state
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tipoAcesso, setTipoAcesso] = useState<"total" | "personalizado">("total");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const resetForm = () => {
    setNomeCompleto("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setTipoAcesso("total");
    setSelectedPermissions([]);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setCurrentStep(1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const togglePermission = (permissionKey: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionKey)
        ? prev.filter(p => p !== permissionKey)
        : [...prev, permissionKey]
    );
  };

  const selectAllInCategory = (categoryPermissions: { key: string }[]) => {
    const keys = categoryPermissions.map(p => p.key);
    const allSelected = keys.every(k => selectedPermissions.includes(k));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !keys.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...keys])]);
    }
  };

  const selectAll = () => {
    const allPerms = getAllPermissions();
    if (selectedPermissions.length === allPerms.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(allPerms);
    }
  };

  const validateStep1 = (): boolean => {
    if (!nomeCompleto.trim()) {
      toast.error("Nome completo é obrigatório");
      return false;
    }

    if (!email.trim()) {
      toast.error("Email é obrigatório");
      return false;
    }

    if (!email.includes("@")) {
      toast.error("Email inválido");
      return false;
    }

    if (!password) {
      toast.error("Senha é obrigatória");
      return false;
    }

    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return false;
    }

    if (password !== confirmPassword) {
      toast.error("Senhas não conferem");
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Você não tem permissão para esta ação.");
      return;
    }
    if (tipoAcesso === "personalizado" && selectedPermissions.length === 0) {
      toast.error("Selecione pelo menos uma permissão para acesso personalizado");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createGestor({
        email,
        password,
        nomeCompleto,
        tipoAcesso,
        permissoes: tipoAcesso === "personalizado" ? selectedPermissions : undefined,
      });

      toast.success(result.message || "Gestor cadastrado com sucesso!");
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao criar gestor:", error);
      toast.error(error.message || "Erro ao cadastrar gestor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastrar Novo Gestor
          </DialogTitle>
          <DialogDescription>
            {currentStep === 1 
              ? "Informe os dados de acesso do gestor."
              : "Escolha o tipo de acesso do gestor."
            }
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            currentStep === 1 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground"
          }`}>
            <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-xs">1</span>
            Dados do Gestor
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            currentStep === 2 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground"
          }`}>
            <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-xs">2</span>
            Tipo de Acesso
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {/* Step 1: Dados do Gestor */}
          {currentStep === 1 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nomeCompleto">Nome Completo *</Label>
                <Input
                  id="nomeCompleto"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  placeholder="Ex: João da Silva"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gestor@empresa.com.br"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Este será o login do gestor
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Tipo de Acesso */}
          {currentStep === 2 && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <Label>Tipo de Acesso *</Label>
                <RadioGroup
                  value={tipoAcesso}
                  onValueChange={(value: "total" | "personalizado") => setTipoAcesso(value)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="total" id="total" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="total" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Globe className="h-4 w-4 text-primary" />
                        Acesso Total (SuperAdm)
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Acesso completo a todas as áreas do sistema.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="personalizado" id="personalizado" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="personalizado" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Settings className="h-4 w-4 text-orange-500" />
                        Acesso Personalizado
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Escolha quais módulos o gestor pode acessar.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Permissões personalizadas */}
              {tipoAcesso === "personalizado" && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Permissões</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAll}
                    >
                      {selectedPermissions.length === getAllPermissions().length
                        ? "Desmarcar Todos"
                        : "Selecionar Todos"}
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-4">
                      {PERMISSION_CATEGORIES.map((category) => {
                        const categoryKeys = category.permissions.map(p => p.key);
                        const allCategorySelected = categoryKeys.every(k => selectedPermissions.includes(k));
                        const someCategorySelected = categoryKeys.some(k => selectedPermissions.includes(k));

                        return (
                          <div key={category.category} className="space-y-2">
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:text-primary"
                              onClick={() => selectAllInCategory(category.permissions)}
                            >
                              <Checkbox
                                checked={allCategorySelected}
                                className={someCategorySelected && !allCategorySelected ? "data-[state=checked]:bg-primary/50" : ""}
                              />
                              <span className="text-lg">{category.icon}</span>
                              <span className="font-medium">{category.category}</span>
                              <span className="text-xs text-muted-foreground">
                                ({categoryKeys.filter(k => selectedPermissions.includes(k)).length}/{categoryKeys.length})
                              </span>
                            </div>

                            <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {category.permissions.map((permission) => (
                                <div
                                  key={permission.key}
                                  className="flex items-center gap-2 cursor-pointer hover:text-primary"
                                  onClick={() => togglePermission(permission.key)}
                                >
                                  <Checkbox
                                    checked={selectedPermissions.includes(permission.key)}
                                  />
                                  <span className="text-sm">{permission.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {selectedPermissions.length > 0 && (
                    <p className="text-sm text-muted-foreground border-t pt-3">
                      {selectedPermissions.length} permissão(ões) selecionada(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          {currentStep === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button onClick={handleNext}>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar Gestor
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGestorModal;
