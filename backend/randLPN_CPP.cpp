//Python module to generate linear physical networks
#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <iostream>
#include <chrono>
#include <random>
#include <CGAL/Simple_cartesian.h>

#define SMALL_NUMBER 1e-14
#define MAX_NODE_TRIAL 100000
#define M_PI 3.14159265358979323846

typedef CGAL::Simple_cartesian<double> Kernel;
typedef Kernel::Point_3 PT;
typedef Kernel::Segment_3 SEG;

// construct a trivial random generator engine from a time-based seed:
unsigned seed = static_cast<unsigned>(std::chrono::system_clock::now().time_since_epoch().count());
std::default_random_engine generator(seed);

template <class GEOM1, class GEOM2>
bool DistTest(double squared_dist, GEOM1& geom, std::vector<GEOM2> &geoms) {
    for (GEOM2 geom2: geoms){
        double sd = CGAL::squared_distance(geom, geom2);
        if ((sd > SMALL_NUMBER) && (sd < squared_dist)){ // questionable practice
            return false;
        }
    }
    return true;
}

// Physical ER - размещение точек с проверкой минимального расстояния
int RandPointCloud(int N, double dist, std::vector<PT> &points){
    int max_node_trial = MAX_NODE_TRIAL;
    double squared_dist = dist * dist;
    PT point;
    std::uniform_real_distribution<double> distribution(0.0, 1.0);

    int n;
    for(n = 0; n < N; n++){
        int trial = 0;
        do{
            point = PT(distribution(generator), distribution(generator), distribution(generator));
            trial++;
        } while((!DistTest<PT,PT>(squared_dist, point, points)) && (trial < max_node_trial));

        if (trial < max_node_trial){
            points.push_back(point);
        } else {
            n--;
            break;
        }
    }
    return n;
}

// Physical ER - полная генерация (все три ограничения: связь-связь, связь-вершина, вершина-вершина)
int LinPhysER_C(int N, int L, double dist, std::vector<PT> &points, std::vector<std::array<int,2>> &vws, std::vector<int> &t_add){
    int n = RandPointCloud(N, dist, points);
    double squared_dist = dist * dist;

    // edges are attempted to be added in random order
    std::vector<std::array<int,2>> order;
    order.reserve(n * (n - 1) / 2);
    for(int v = 0; v < n; v++)
        for(int w = v + 1; w < n; w++)
            order.push_back({v, w});
    std::shuffle(std::begin(order), std::end(order), generator);

    // let's get ready to add those edges
    int l = 0, t = 0;
    std::vector<SEG> segs;
    segs.reserve(L);
    vws.reserve(L);
    t_add.reserve(L);

    // let's add those edges
    for (auto vw: order){
        SEG seg(points[vw[0]], points[vw[1]]);
        if (DistTest<SEG,PT>(squared_dist, seg, points) && DistTest<SEG,SEG>(squared_dist, seg, segs)){
            segs.push_back(seg);
            vws.push_back({vw[0], vw[1]});
            t_add.push_back(t);
            l++;
            if (l == L) break;
        }
        t++;
    }
    return n;
}

// only considering link-link interaction
// nodes are still placed at least lambda (=dist) away from each other
int LinPhysER_linkonly_C(int N, int L, double dist, std::vector<PT> &points, std::vector<std::array<int,2>> &vws, std::vector<int> &t_add){
    double squared_dist = dist * dist;
    std::uniform_real_distribution<double> distribution(0.0, 1.0);
    for(int n = 0; n < N; n++)
        points.push_back(PT(distribution(generator), distribution(generator), distribution(generator)));

    // edges are attempted to be added in random order
    std::vector<std::array<int,2>> order;
    order.reserve(N * (N - 1) / 2);
    for(int v = 0; v < N; v++)
        for(int w = v + 1; w < N; w++)
            order.push_back({v, w});
    std::shuffle(std::begin(order), std::end(order), generator);

    // let's get ready to add those edges
    int l = 0, t = 0;
    std::vector<SEG> segs;
    segs.reserve(L);
    vws.reserve(L);
    t_add.reserve(L);

    // let's add those edges
    for (auto vw: order){
        SEG seg(points[vw[0]], points[vw[1]]);
        if (DistTest<SEG,SEG>(squared_dist, seg, segs)){
            segs.push_back(seg);
            vws.push_back({vw[0], vw[1]});
            t_add.push_back(t);
            l++;
            if (l == L) break;
        }
        t++;
    }
    return N;
}

// НОВАЯ ОБОБЩЁННАЯ ФУНКЦИЯ: настраиваемые физические ограничения
// check_node_node: если true, проверяется расстояние между узлами (физическое ограничение 3)
// check_node_link: если true, проверяется пересечение связей с узлами (физическое ограничение 2)
// Физическое ограничение 1 (связь-связь) проверяется всегда
int LinPhysER_general_C(int N, int L, double dist,
                        std::vector<PT> &points,
                        std::vector<std::array<int,2>> &vws,
                        std::vector<int> &t_add,
                        bool check_node_node, bool check_node_link){
    double squared_dist = dist * dist;

    // Размещение узлов
    if (check_node_node) {
        // С проверкой расстояний между узлами (физическое ограничение 3)
        RandPointCloud(N, dist, points);
    } else {
        // Без проверки — просто случайные точки
        std::uniform_real_distribution<double> distribution(0.0, 1.0);
        for (int n = 0; n < N; n++)
            points.push_back(PT(distribution(generator), distribution(generator), distribution(generator)));
    }

    int n = static_cast<int>(points.size());

    // Случайный порядок кандидатов в рёбра
    std::vector<std::array<int,2>> order;
    order.reserve(n * (n - 1) / 2);
    for(int v = 0; v < n; v++)
        for(int w = v + 1; w < n; w++)
            order.push_back({v, w});
    std::shuffle(std::begin(order), std::end(order), generator);

    // Добавление рёбер
    int l = 0, t = 0;
    std::vector<SEG> segs;
    segs.reserve(L);
    vws.reserve(L);
    t_add.reserve(L);

    for (auto vw: order){
        SEG seg(points[vw[0]], points[vw[1]]);
        bool ok = true;

        // Проверка связь-вершина (физическое ограничение 2)
        if (check_node_link) {
            ok = ok && DistTest<SEG,PT>(squared_dist, seg, points);
        }

        // Проверка связь-связь (физическое ограничение 1) — всегда
        ok = ok && DistTest<SEG,SEG>(squared_dist, seg, segs);

        if (ok) {
            segs.push_back(seg);
            vws.push_back({vw[0], vw[1]});
            t_add.push_back(t);
            l++;
            if (l == L) break;
        }
        t++;
    }

    return n;
}

// НОВАЯ ФУНКЦИЯ: принимает точки из Python (для поддержки разных распределений)
// points_in: входные точки из Python
int LinPhysER_general_with_points_C(int L, double dist,
                                     const std::vector<PT> &points_in,
                                     std::vector<std::array<int,2>> &vws,
                                     std::vector<int> &t_add,
                                     bool check_node_node, bool check_node_link){
    double squared_dist = dist * dist;
    int n = static_cast<int>(points_in.size());

    // Копируем входные точки
    std::vector<PT> points = points_in;

    // Если нужна проверка расстояний между узлами, фильтруем точки
    if (check_node_node) {
        std::vector<PT> filtered_points;
        filtered_points.reserve(n);

        for (int i = 0; i < n; i++) {
            bool valid = true;
            for (const PT& existing : filtered_points) {
                if (CGAL::squared_distance(points[i], existing) < squared_dist) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                filtered_points.push_back(points[i]);
            }
        }
        points = filtered_points;
        n = static_cast<int>(points.size());
    }

    // Случайный порядок кандидатов в рёбра
    std::vector<std::array<int,2>> order;
    order.reserve(n * (n - 1) / 2);
    for(int v = 0; v < n; v++)
        for(int w = v + 1; w < n; w++)
            order.push_back({v, w});
    std::shuffle(std::begin(order), std::end(order), generator);

    // Добавление рёбер
    int l = 0, t = 0;
    std::vector<SEG> segs;
    segs.reserve(L);
    vws.reserve(L);
    t_add.reserve(L);

    for (auto vw: order){
        SEG seg(points[vw[0]], points[vw[1]]);
        bool ok = true;

        // Проверка связь-вершина
        if (check_node_link) {
            ok = ok && DistTest<SEG,PT>(squared_dist, seg, points);
        }

        // Проверка связь-связь
        ok = ok && DistTest<SEG,SEG>(squared_dist, seg, segs);

        if (ok) {
            segs.push_back(seg);
            vws.push_back({vw[0], vw[1]});
            t_add.push_back(t);
            l++;
            if (l == L) break;
        }
        t++;
    }

    return n;
}

// distance for all pairs of segments upto a threshold
void AllToAllSegmentSquaredDist_C(int N, double maxsd, std::vector<PT> &points, std::vector<std::array<int,2>> &vws, std::vector<std::array<int,2>> &metaedges, std::vector<double> &squareddists){
    // pick random points
    std::uniform_real_distribution<double> distribution(0.0, 1.0);
    for(int n = 0; n < N; n++)
        points.push_back(PT(distribution(generator), distribution(generator), distribution(generator)));

    // create segment objects
    std::vector<SEG> segs;
    segs.reserve(N * (N - 1) / 2);
    vws.reserve(N * (N - 1) / 2);

    for(int v = 0; v < N; v++)
        for(int w = v + 1; w < N; w++){
            segs.push_back(SEG(points[v], points[w]));
            vws.push_back({v, w});
        }

    double sd;
    for(int s = 0; s < (int)vws.size(); s++)
        for(int t = s + 1; t < (int)vws.size(); t++){
            if(vws[s][0] != vws[t][0] && vws[s][0] != vws[t][1] && vws[s][1] != vws[t][0] && vws[s][1] != vws[t][1]){
                sd = CGAL::squared_distance(segs[s], segs[t]);
                if (sd < maxsd){
                    squareddists.push_back(sd);
                    metaedges.push_back({s, t});
                }
            }
        }
    return;
}

//****************************
// Exposing functions to python
//****************************

static PyObject* LinPhysER(PyObject* self, PyObject* args){
    int N, L;
    double d;
    if (!PyArg_ParseTuple(args, "iid", &N, &L, &d))
        return NULL;

    std::vector<PT> points;
    points.reserve(N);
    std::vector<std::array<int,2>> vws;
    std::vector<int> t_add;

    LinPhysER_C(N, L, d, points, vws, t_add);

    PyObject* python_points = PyList_New(points.size());
    for (int v = 0; v < (int)points.size(); v++)
        PyList_SetItem(python_points, v, Py_BuildValue("(fff)", points[v].x(), points[v].y(), points[v].z()));

    PyObject* python_vws = PyList_New(vws.size());
    for (int e = 0; e < (int)vws.size(); e++)
        PyList_SetItem(python_vws, e, Py_BuildValue("(ii)", vws[e][0], vws[e][1]));

    PyObject* python_t_add = PyList_New(t_add.size());
    for (int e = 0; e < (int)t_add.size(); e++)
        PyList_SetItem(python_t_add, e, PyLong_FromLong(t_add[e]));

    PyObject* return_tuple = Py_BuildValue("(OOO)", python_points, python_vws, python_t_add);

    Py_DECREF(python_points);
    Py_DECREF(python_vws);
    Py_DECREF(python_t_add);

    return return_tuple;
}

static PyObject* LinPhysER_linkonly(PyObject* self, PyObject* args){
    int N, L;
    double d;
    if (!PyArg_ParseTuple(args, "iid", &N, &L, &d))
        return NULL;

    std::vector<PT> points;
    points.reserve(N);
    std::vector<std::array<int,2>> vws;
    std::vector<int> t_add;

    LinPhysER_linkonly_C(N, L, d, points, vws, t_add);

    PyObject* python_points = PyList_New(points.size());
    for (int v = 0; v < (int)points.size(); v++)
        PyList_SetItem(python_points, v, Py_BuildValue("(fff)", points[v].x(), points[v].y(), points[v].z()));

    PyObject* python_vws = PyList_New(vws.size());
    for (int e = 0; e < (int)vws.size(); e++)
        PyList_SetItem(python_vws, e, Py_BuildValue("(ii)", vws[e][0], vws[e][1]));

    PyObject* python_t_add = PyList_New(t_add.size());
    for (int e = 0; e < (int)t_add.size(); e++)
        PyList_SetItem(python_t_add, e, PyLong_FromLong(t_add[e]));

    PyObject* return_tuple = Py_BuildValue("(OOO)", python_points, python_vws, python_t_add);

    Py_DECREF(python_points);
    Py_DECREF(python_vws);
    Py_DECREF(python_t_add);

    return return_tuple;
}

// НОВАЯ Python-обёртка для обобщённой функции
static PyObject* LinPhysER_general(PyObject* self, PyObject* args){
    int N, L;
    double d;
    int check_node_node, check_node_link;

    if (!PyArg_ParseTuple(args, "iidii", &N, &L, &d, &check_node_node, &check_node_link))
        return NULL;

    std::vector<PT> points;
    points.reserve(N);
    std::vector<std::array<int,2>> vws;
    std::vector<int> t_add;

    LinPhysER_general_C(N, L, d, points, vws, t_add,
                        (bool)check_node_node, (bool)check_node_link);

    PyObject* python_points = PyList_New(points.size());
    for (int v = 0; v < (int)points.size(); v++)
        PyList_SetItem(python_points, v, Py_BuildValue("(fff)", points[v].x(), points[v].y(), points[v].z()));

    PyObject* python_vws = PyList_New(vws.size());
    for (int e = 0; e < (int)vws.size(); e++)
        PyList_SetItem(python_vws, e, Py_BuildValue("(ii)", vws[e][0], vws[e][1]));

    PyObject* python_t_add = PyList_New(t_add.size());
    for (int e = 0; e < (int)t_add.size(); e++)
        PyList_SetItem(python_t_add, e, PyLong_FromLong(t_add[e]));

    PyObject* return_tuple = Py_BuildValue("(OOO)", python_points, python_vws, python_t_add);

    Py_DECREF(python_points);
    Py_DECREF(python_vws);
    Py_DECREF(python_t_add);

    return return_tuple;
}

// НОВАЯ Python-обёртка для функции с внешними точками
// Принимает точки как список списков или список кортежей [[x,y,z], ...] или [(x,y,z), ...]
static PyObject* LinPhysER_general_with_points(PyObject* self, PyObject* args){
    int L;
    double d;
    PyObject* points_list;
    int check_node_node, check_node_link;
    
    if (!PyArg_ParseTuple(args, "idOii", &L, &d, &points_list, &check_node_node, &check_node_link))
        return NULL;
    
    // Проверяем, что аргумент - список
    if (!PyList_Check(points_list)) {
        PyErr_SetString(PyExc_TypeError, "Points must be a list of [x,y,z] coordinates");
        return NULL;
    }
    
    Py_ssize_t n_points = PyList_Size(points_list);
    std::vector<PT> points_in;
    points_in.reserve(n_points);
    
    for (Py_ssize_t i = 0; i < n_points; i++) {
        PyObject* point = PyList_GetItem(points_list, i);  // borrowed reference
        if (!point) {
            PyErr_SetString(PyExc_RuntimeError, "Failed to get point from list");
            return NULL;
        }
        
        // Проверяем, что point - последовательность (список или кортеж)
        if (!PySequence_Check(point)) {
            PyErr_SetString(PyExc_TypeError, "Each point must be a sequence [x,y,z]");
            return NULL;
        }
        
        Py_ssize_t coord_count = PySequence_Size(point);
        if (coord_count != 3) {
            PyErr_Format(PyExc_ValueError, "Each point must have 3 coordinates, got %zd", coord_count);
            return NULL;
        }
        
        // Используем PySequence_GetItem - работает и со списками, и с кортежами
        PyObject* x_obj = PySequence_GetItem(point, 0);  // new reference
        PyObject* y_obj = PySequence_GetItem(point, 1);
        PyObject* z_obj = PySequence_GetItem(point, 2);
        
        if (!x_obj || !y_obj || !z_obj) {
            Py_XDECREF(x_obj);
            Py_XDECREF(y_obj);
            Py_XDECREF(z_obj);
            PyErr_SetString(PyExc_RuntimeError, "Failed to get coordinate");
            return NULL;
        }
        
        double x = PyFloat_AsDouble(x_obj);
        double y = PyFloat_AsDouble(y_obj);
        double z = PyFloat_AsDouble(z_obj);
        
        Py_DECREF(x_obj);
        Py_DECREF(y_obj);
        Py_DECREF(z_obj);
        
        // PyFloat_AsDouble возвращает -1.0 при ошибке
        if (x == -1.0 && PyErr_Occurred()) return NULL;
        if (y == -1.0 && PyErr_Occurred()) return NULL;
        if (z == -1.0 && PyErr_Occurred()) return NULL;
        
        points_in.push_back(PT(x, y, z));
    }
    
    std::vector<std::array<int,2>> vws;
    std::vector<int> t_add;
    
    try {
        LinPhysER_general_with_points_C(L, d, points_in, vws, t_add,
                                         (bool)check_node_node, (bool)check_node_link);
    } catch (const std::exception& e) {
        PyErr_Format(PyExc_RuntimeError, "C++ exception: %s", e.what());
        return NULL;
    } catch (...) {
        PyErr_SetString(PyExc_RuntimeError, "Unknown C++ exception");
        return NULL;
    }
    
    // Возвращаем только связи и время добавления (точки уже есть в Python)
    PyObject* python_vws = PyList_New(vws.size());
    for (size_t e = 0; e < vws.size(); e++)
        PyList_SetItem(python_vws, e, Py_BuildValue("(ii)", vws[e][0], vws[e][1]));
    
    PyObject* python_t_add = PyList_New(t_add.size());
    for (size_t e = 0; e < t_add.size(); e++)
        PyList_SetItem(python_t_add, e, PyLong_FromLong(t_add[e]));
    
    PyObject* return_tuple = Py_BuildValue("(OO)", python_vws, python_t_add);
    
    Py_DECREF(python_vws);
    Py_DECREF(python_t_add);
    
    return return_tuple;
}

static PyObject* AllToAllSegmentSquaredDist(PyObject* self, PyObject* args){
    int N;
    double maxsd;

    if (!PyArg_ParseTuple(args, "id", &N, &maxsd))
        return NULL;

    std::vector<PT> points;
    points.reserve(N);
    std::vector<std::array<int,2>> vws;
    std::vector<std::array<int,2>> metaedges;
    std::vector<double> squareddists;

    AllToAllSegmentSquaredDist_C(N, maxsd, points, vws, metaedges, squareddists);

    PyObject* python_points = PyList_New(points.size());
    for (int v = 0; v < (int)points.size(); v++)
        PyList_SetItem(python_points, v, Py_BuildValue("(fff)", points[v].x(), points[v].y(), points[v].z()));

    PyObject* python_vws = PyList_New(vws.size());
    for (int e = 0; e < (int)vws.size(); e++)
        PyList_SetItem(python_vws, e, Py_BuildValue("(ii)", vws[e][0], vws[e][1]));

    PyObject* python_metaedges = PyList_New(metaedges.size());
    for (int e = 0; e < (int)metaedges.size(); e++)
        PyList_SetItem(python_metaedges, e, Py_BuildValue("(ii)", metaedges[e][0], metaedges[e][1]));

    PyObject* python_squareddists = PyList_New(squareddists.size());
    for (int x = 0; x < (int)squareddists.size(); x++)
        PyList_SetItem(python_squareddists, x, Py_BuildValue("f", squareddists[x]));

    PyObject* return_tuple = Py_BuildValue("(OOOO)", python_points, python_vws, python_metaedges, python_squareddists);

    Py_DECREF(python_points);
    Py_DECREF(python_vws);
    Py_DECREF(python_metaedges);
    Py_DECREF(python_squareddists);

    return return_tuple;
}

static PyMethodDef mainMethods[] = {
    {"LinPhysER", LinPhysER, METH_VARARGS, "Generate linear physical ER"},
    {"LinPhysER_linkonly", LinPhysER_linkonly, METH_VARARGS, "Generate linear physical ER, link-link interaction only"},
    {"LinPhysER_general", LinPhysER_general, METH_VARARGS, "Generate LPN with configurable physical constraints"},
    {"LinPhysER_general_with_points", LinPhysER_general_with_points, METH_VARARGS, "Generate LPN with external points and configurable physical constraints"},
    {"AllToAllSegmentSquaredDist", AllToAllSegmentSquaredDist, METH_VARARGS, "Drop N random points and calculate the distance between all segment pairs"},
    {NULL, NULL, 0, NULL}
};

static PyModuleDef randLPN_CPP = {
    PyModuleDef_HEAD_INIT,
    "randLPN_CPP", "randLPN_CPP",
    -1,
    mainMethods
};

PyMODINIT_FUNC PyInit_randLPN_CPP(void){
    return PyModule_Create(&randLPN_CPP);
}