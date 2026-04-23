DROP POLICY IF EXISTS "Calendario operacional editável por autenticados" ON public.bd_diaria_calendario_operacional;

CREATE POLICY "Calendario operacional pode ser criado por autenticados"
ON public.bd_diaria_calendario_operacional
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Calendario operacional pode ser atualizado por autenticados"
ON public.bd_diaria_calendario_operacional
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Calendario operacional pode ser removido por autenticados"
ON public.bd_diaria_calendario_operacional
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);