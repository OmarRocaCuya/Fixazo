// Caso curado a mano. Las fuentes son reales; la traducción es nuestra.
// Todo lo que está en "privado" lo ve solo el servidor (criterios, respuestas correctas y respuesta modelo).

const fragmentosB = [
  'En lo que respecta al satélite en sí, ',
  'eso no aumenta mis preocupaciones, ni un ápice. ',
  'No veo nada en este momento, en esta etapa, que sea importante para la seguridad, ',
  'excepto que demuestra que los científicos rusos tienen un empuje muy poderoso en sus cohetes, y eso es importante. (…) ',
  'Incluso ahora los rusos, ',
  'bajo una sociedad dictatorial, ',
  'donde tenían a algunos de los mejores científicos del mundo trabajando en esto durante muchos años, ',
  'aparentemente, por lo que ellos dicen, ',
  'han puesto una pequeña pelota en el aire.',
];

export default {
  id: 'sputnik-1957',
  titulo: 'Sputnik, 1957',
  gancho: 'Un mismo satélite, dos versiones. ¿Quién te está convenciendo de qué?',
  contexto:
    'Octubre de 1957. Estados Unidos y la Unión Soviética compiten en la Guerra Fría: armas, ciencia y prestigio. El 4 de octubre, la Unión Soviética lanza el Sputnik.',
  fuentes: {
    A: {
      autor: 'TASS, agencia oficial de noticias del gobierno soviético',
      medio: 'Publicado en el diario Pravda',
      fecha: '5 de octubre de 1957',
      nota: 'Un día después del lanzamiento.',
      texto:
        'Como resultado de un trabajo muy intenso de los institutos de investigación científica y las oficinas de diseño, se ha creado el primer satélite artificial del mundo. El 4 de octubre de 1957, este primer satélite fue lanzado con éxito en la URSS. (…) El exitoso lanzamiento del primer satélite terrestre hecho por el hombre es una contribución importantísima al tesoro de la ciencia y la cultura mundiales. (…) Los satélites artificiales abrirán el camino a los viajes interplanetarios y, al parecer, nuestros contemporáneos verán cómo el trabajo libre y consciente del pueblo de la nueva sociedad socialista hace realidad los sueños más audaces de la humanidad.',
      original:
        'As a result of very intensive work by scientific research institutes and design bureaus the first artificial satellite in the world has been created. On October 4, 1957, this first satellite was successfully launched in the USSR. [...] The successful launching of the first man-made earth satellite makes a most important contribution to the treasure-house of world science and culture. [...] Artificial earth satellites will pave the way to interplanetary travel and, apparently our contemporaries will witness how the freed and conscientious labor of the people of the new socialist society makes the most daring dreams of mankind a reality.',
      referencia: 'F. J. Krieger, Behind the Sputniks (1958), pp. 311-312. NASA History Division.',
      url: 'https://www.nasa.gov/history/sputnik/14.html',
    },
    B: {
      autor: 'Dwight D. Eisenhower, presidente de Estados Unidos',
      medio: 'Conferencia de prensa en la Casa Blanca',
      fecha: '9 de octubre de 1957',
      nota: 'En ese momento, Estados Unidos todavía no había lanzado ningún satélite.',
      fragmentos: fragmentosB,
      texto: fragmentosB.join(''),
      original:
        'Now, so far as the satellite itself is concerned, that does not raise my apprehensions, not one iota. I see nothing at this moment, at this stage of development, that is significant in that development as far as security is concerned, except, as I pointed out, it does definitely prove the possession by the Russian scientists of a very powerful thrust in their rocketry, and that is important. [...] even now the Russians, under a dictatorial society where they had some of the finest scientists in the world who have for many years been working on this, apparently from what they say they have put one small ball in the air.',
      referencia: "The President's News Conference, October 9, 1957. The American Presidency Project, UC Santa Barbara.",
      url: 'https://www.presidency.ucsb.edu/documents/the-presidents-news-conference-308',
    },
  },
  pasos: [
    {
      tipo: 'ficha',
      fuente: 'A',
      prediccion: {
        id: 'pred-A',
        pregunta: 'Antes de leer: ¿cómo crees que TASS contará la noticia?',
        opciones: ['Con orgullo, como un gran triunfo', 'Solo con datos técnicos, sin opinar', 'Con cautela, sin dar muchos detalles'],
      },
    },
    { tipo: 'fuente', fuente: 'A' },
    {
      tipo: 'pregunta',
      id: 'p1',
      habilidad: 'Comprensión',
      fuentes: ['A'],
      pregunta: 'Según TASS, ¿qué logró la Unión Soviética? Explícalo con tus palabras.',
      pistas: ['Busca la palabra «primer» en el texto.', '¿Qué se lanzó el 4 de octubre de 1957, y qué tenía de especial?'],
      privado: {
        criterios: [
          {
            id: 'hecho',
            nombre: 'El hecho',
            descripcion: 'Dice que la URSS lanzó o puso en órbita un satélite artificial.',
            ejemplo_cumple: 'Lanzaron un satélite al espacio.',
            ejemplo_no_cumple: 'Hicieron un cohete muy rápido.',
            repregunta: '¿Qué objeto lanzaron, según el texto?',
          },
          {
            id: 'primero',
            nombre: 'Lo especial',
            descripcion: 'Menciona que era el primero del mundo o de la historia.',
            ejemplo_cumple: 'Fue el primer satélite del mundo.',
            ejemplo_no_cumple: 'Lanzaron otro satélite más.',
            repregunta: '¿Qué tenía de especial ese satélite comparado con los demás?',
          },
        ],
        respuesta_modelo: 'La URSS lanzó el primer satélite artificial del mundo, el 4 de octubre de 1957.',
        prohibido: ['primer satelite', 'primero del mundo'],
      },
    },
    {
      tipo: 'pregunta',
      id: 'p2',
      habilidad: 'Procedencia',
      fuentes: ['A'],
      eleccion: {
        pregunta: '¿Para qué crees que TASS publicó la noticia de esta forma?',
        opciones: [
          'Solo para informar datos científicos',
          'Para informar y, además, mostrar que su sociedad es superior',
          'Para advertir al mundo de un peligro',
        ],
      },
      pregunta: '¿Qué parte del texto te hizo elegir eso? Explícalo.',
      pistas: [
        'Vuelve a leer la última frase del texto.',
        '¿Qué tipo de sociedad menciona TASS al final? ¿Por qué un gobierno la mencionaría en una noticia científica?',
      ],
      privado: {
        eleccion_correcta: 1,
        retro_codigo: 'Revisa tu elección. ¿El texto solo da datos, o en la última frase dice algo más sobre quién lo logró?',
        criterios: [
          {
            id: 'evidencia',
            nombre: 'Evidencia',
            descripcion:
              'Menciona o cita una parte concreta del texto de TASS que muestre su intención (la última frase, la sociedad socialista, el primer satélite del mundo, los sueños más audaces de la humanidad).',
            ejemplo_cumple: 'Porque al final habla de la nueva sociedad socialista.',
            ejemplo_no_cumple: 'Porque se nota.',
            repregunta: '¿Qué frase del texto te hace pensar eso?',
          },
          {
            id: 'razon',
            nombre: 'Razón',
            descripcion:
              'Conecta esa evidencia con quién publica (el gobierno soviético) y lo que gana (prestigio, propaganda, mostrar su sistema, competir con Estados Unidos).',
            ejemplo_cumple: 'Es la agencia del gobierno y quiere que el mundo vea que su sistema funciona.',
            ejemplo_no_cumple: 'Porque los rusos lanzaron un satélite.',
            repregunta: '¿Quién publicó esto, y qué ganaba contándolo así?',
          },
        ],
        respuesta_modelo:
          'TASS es la agencia del gobierno soviético; además de los datos, al final atribuye el logro al trabajo del pueblo de la nueva sociedad socialista, para ganar prestigio frente a Estados Unidos.',
        prohibido: ['propaganda', 'sociedad socialista', 'prestigio'],
      },
    },
    {
      tipo: 'ficha',
      fuente: 'B',
      prediccion: {
        id: 'pred-B',
        pregunta: 'Antes de leer: Estados Unidos iba perdiendo la carrera. ¿Cómo crees que reaccionará su presidente?',
        opciones: ['Alarmado, diciendo que es un gran peligro', 'Restándole importancia', 'Felicitando a la Unión Soviética'],
      },
    },
    { tipo: 'fuente', fuente: 'B' },
    {
      tipo: 'pregunta',
      id: 'p3',
      habilidad: 'Corroboración y contexto',
      fuentes: ['A', 'B'],
      orden: {
        instruccion: 'Para cada afirmación: ¿TASS y Eisenhower coinciden o chocan?',
        afirmaciones: ['La URSS puso un satélite en órbita.', 'Es un logro enorme para la humanidad.', 'Los científicos soviéticos son muy capaces.'],
        grupos: ['Coinciden', 'Chocan'],
      },
      pregunta: '¿Por qué crees que cuentan tan distinto el mismo hecho?',
      pistas: [
        'Piensa en quién iba ganando la carrera en octubre de 1957.',
        'Si fueras el presidente del país que va perdiendo, ¿cómo se lo contarías a tu gente?',
      ],
      privado: {
        orden_correcto: [0, 1, 0],
        retro_codigo: 'Revisa las afirmaciones. Por ejemplo: ¿Eisenhower dice que los científicos rusos son malos, o reconoce algo de ellos?',
        criterios: [
          {
            id: 'razon_a',
            nombre: 'Por qué TASS lo agranda',
            descripcion: 'Explica por qué TASS presenta el hecho como un gran triunfo (orgullo, propaganda, prestigio, mostrar su sistema).',
            ejemplo_cumple: 'La URSS quería presumir su logro.',
            ejemplo_no_cumple: 'Porque TASS es una agencia.',
            repregunta: '¿Qué ganaba la Unión Soviética al contarlo como un gran triunfo?',
          },
          {
            id: 'razon_b',
            nombre: 'Por qué Eisenhower lo achica',
            descripcion: 'Explica por qué Eisenhower le resta importancia (calmar al público, no mostrar debilidad, no reconocer que iban perdiendo).',
            ejemplo_cumple: 'Eisenhower no quería que la gente se asustara.',
            ejemplo_no_cumple: 'Porque no le gustaba el satélite.',
            repregunta: '¿Qué le pasaría a Eisenhower si admitiera que iban perdiendo?',
          },
          {
            id: 'contexto',
            nombre: 'Contexto',
            descripcion: 'Menciona la rivalidad entre los dos países, la Guerra Fría o que Estados Unidos todavía no tenía satélite.',
            ejemplo_cumple: 'Estaban compitiendo en la Guerra Fría.',
            ejemplo_no_cumple: 'Era el año 1957.',
            repregunta: '¿Qué relación tenían los dos países en 1957?',
          },
        ],
        respuesta_modelo:
          'Eran rivales en la Guerra Fría. La URSS quería presumir su ventaja y Estados Unidos, que aún no tenía satélite, quería calmar a su población y no mostrar que iba detrás.',
        prohibido: ['calmar', 'tranquilizar', 'guerra fria', 'presumir', 'iba perdiendo', 'no tenia satelite'],
      },
    },
    {
      tipo: 'pregunta',
      id: 'p4',
      habilidad: 'Lectura atenta',
      fuentes: ['B'],
      tocar: { fuente: 'B', instruccion: 'Toca la frase con la que Eisenhower le resta importancia al satélite.' },
      pregunta: '¿Por qué crees que eligió esas palabras?',
      pistas: ['¿Una «pequeña pelota» suena a algo peligroso o a algo inofensivo?', '¿Qué querría que sintiera la gente que lo escuchaba?'],
      privado: {
        toques_correctos: [1, 7, 8],
        retro_codigo: 'Esa frase no le resta importancia. Busca una que haga ver el satélite como algo pequeño o poco preocupante.',
        criterios: [
          {
            id: 'efecto',
            nombre: 'Efecto de las palabras',
            descripcion: 'Explica que esas palabras hacen ver el satélite como algo pequeño, sin importancia o poco preocupante.',
            ejemplo_cumple: 'Dice pelota para que parezca algo pequeño.',
            ejemplo_no_cumple: 'Porque así habla él.',
            repregunta: '¿Cómo se ve el satélite cuando lo llaman así?',
          },
          {
            id: 'intencion',
            nombre: 'Intención',
            descripcion: 'Dice para qué lo hizo: tranquilizar a la gente, no reconocer la ventaja soviética o no parecer débil.',
            ejemplo_cumple: 'Para que la gente no se asuste.',
            ejemplo_no_cumple: 'Porque era el presidente.',
            repregunta: '¿Qué quería que sintiera la gente que lo escuchaba?',
          },
        ],
        respuesta_modelo:
          'Llamarlo una pequeña pelota en el aire lo hace parecer inofensivo, para tranquilizar a la población y no admitir la ventaja soviética.',
        prohibido: ['tranquilizar', 'calmar', 'no se asuste', 'inofensivo', 'ventaja'],
      },
    },
    { tipo: 'resumen' },
  ],
  repaso: {
    tipo: 'pregunta',
    id: 'repaso',
    habilidad: 'Repaso',
    fuentes: [],
    pregunta: 'Sin mirar las fuentes: ¿cómo contó cada país el lanzamiento del Sputnik, y por qué lo contaron así?',
    pistas: ['Uno lo celebró y el otro lo hizo ver pequeño. ¿Cuál fue cuál?'],
    privado: {
      criterios: [
        {
          id: 'versiones',
          nombre: 'Las dos versiones',
          descripcion: 'Dice que la URSS (TASS) lo presentó como un gran logro y Estados Unidos (Eisenhower) le restó importancia.',
          ejemplo_cumple: 'Los rusos lo celebraron y Eisenhower dijo que no era nada.',
          ejemplo_no_cumple: 'Los dos dijeron lo mismo.',
          repregunta: '¿Cuál de los dos lo celebró y cuál lo minimizó?',
        },
        {
          id: 'porque',
          nombre: 'El porqué',
          descripcion: 'Da una razón ligada a la rivalidad o a lo que ganaba cada uno.',
          ejemplo_cumple: 'Porque competían y cada uno quería quedar bien.',
          ejemplo_no_cumple: 'Porque sí.',
          repregunta: '¿Qué ganaba cada uno contándolo a su manera?',
        },
      ],
      respuesta_modelo: 'La URSS lo presentó como un triunfo de su sociedad y Eisenhower lo minimizó; eran rivales y cada uno cuidaba su imagen.',
      prohibido: ['triunfo', 'minimizo', 'rivales'],
    },
  },
};
