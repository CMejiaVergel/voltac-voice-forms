import { Question } from '@/types';

export const questions: Question[] = [
  {
    id: 1,
    text: '¿Cuál es tu nombre y el de tu empresa o negocio?',
    key: 'nombre_empresa',
  },
  {
    id: 2,
    text: '¿A qué se dedica tu empresa o cuál es tu actividad profesional?',
    key: 'actividad',
  },
  {
    id: 3,
    text: '¿Cuál es el principal problema o tarea repetitiva que te gustaría resolver o automatizar?',
    key: 'problema_principal',
  },
  {
    id: 4,
    text: '¿Cómo manejas actualmente ese proceso? Por ejemplo: de forma manual, con Excel, con algún software, etc.',
    key: 'proceso_actual',
  },
  {
    id: 5,
    text: '¿Qué resultado esperarías si pudieras optimizar esto?',
    key: 'resultado_esperado',
  },
  {
    id: 6,
    text: '¿Cuántas personas están involucradas en este proceso actualmente?',
    key: 'personas_involucradas',
  },
  {
    id: 7,
    text: '¿Tienes un presupuesto estimado o un rango que tengas en mente para esta solución?',
    key: 'presupuesto',
  },
  {
    id: 8,
    text: '¿Cuál es tu medio de contacto preferido y tu disponibilidad para una reunión?',
    key: 'contacto_disponibilidad',
  },
];
