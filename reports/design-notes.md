# Diseño de GymTrack

Aplicado según `.agents/skills/frontend-design/SKILL.md` y la dirección aprobada: deportivo oscuro con acento lima.

## Tokens

Fondo `#14181B`, superficies `#20262B`, texto `#F5F7F2`, secundarios `#ADB7B5`, acción `#D4F05A`, error `#FF6B61`. Barlow Condensed para títulos y tiempos; Barlow para lectura y controles. Fuentes locales con licencia OFL.

## Revisión de la propuesta

La combinación oscuro/lima se conserva por preferencia explícita. Para evitar una composición genérica de tarjetas idénticas, el foco visual está en el inicio de la sesión y las series: Inicio tiene una acción dominante, rutinas personales usan una superficie propia, la biblioteca y el catálogo son listas, y el progreso depende exclusivamente del historial real.

```text
Inicio                         Sesión
GymTrack       Ajustes          Minimizar          Terminar
Entrenar / Retomar              Día                 Tiempo
Resumen                        Progreso de series
Rutinas e historial            Ejercicio + instrucciones
Instalación                    Peso / Reps / Completar
Navegación                     Descanso
```

Contenido alineado a la izquierda. Jerarquía por tipografía, espacio y divisores funcionales; números de posición sólo en ejercicios y pasos que tienen orden. Sin entradas animadas por sección. Los controles mantienen un piso táctil de 44 px, con foco visible y soporte de movimiento reducido.

La revisión de capturas redujo el espacio de programación opcional del editor mediante un panel desplegable y colocó los controles numéricos debajo del nombre del ejercicio. El dock del entrenamiento ocupa espacio real del layout y el modal sigue el visual viewport para mantener las acciones accesibles cuando aparece el teclado.
