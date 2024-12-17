<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>To-Do Liste</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
        }
        input[type="text"] {
            padding: 5px;
            margin-right: 10px;
        }
        button {
            padding: 5px 10px;
        }
        ul {
            list-style-type: none;
        }
        li {
            margin: 10px 0;
        }
    </style>
</head>
<body>

    <h1>To-Do Liste</h1>

    <input type="text" id="taskInput" placeholder="Neue Aufgabe hinzufügen...">
    <button onclick="addTask()">Hinzufügen</button>

    <h2>Deine Aufgaben:</h2>
    <ul id="todoList"></ul>

    <script>
        // Array für die Aufgaben
        let todoList = [];

        // Funktion zum Hinzufügen einer Aufgabe
        function addTask() {
            const taskInput = document.getElementById("taskInput");
            const task = taskInput.value.trim();

            if (task !== "") {
                todoList.push(task);
                taskInput.value = ""; // Eingabefeld leeren
                renderList(); // Liste neu rendern
            } else {
                alert("Bitte eine Aufgabe eingeben.");
            }
        }

        // Funktion zum Löschen einer Aufgabe
        function deleteTask(index) {
            todoList.splice(index, 1); // Aufgabe löschen
            renderList(); // Liste neu rendern
        }

        // Funktion zum Rendern der Liste
        function renderList() {
            const todoListElement = document.getElementById("todoList");
            todoListElement.innerHTML = ""; // Alte Liste löschen

            todoList.forEach((task, index) => {
                const li = document.createElement("li");
                li.textContent = task;

                // Erstellen eines Lösch-Buttons
                const deleteButton = document.createElement("button");
                deleteButton.textContent = "Löschen";
                deleteButton.onclick = function() {
                    deleteTask(index);
                };

                // Löschen-Button zum Listeneintrag hinzufügen
                li.appendChild(deleteButton);

                // Listeneintrag zur Liste hinzufügen
                todoListElement.appendChild(li);
            });
        }
    </script>

</body>
</html>
