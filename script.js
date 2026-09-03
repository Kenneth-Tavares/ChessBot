//elements from html page
const titleElement = document.getElementById('title');
const buttonElement = document.getElementById('changeBtn');

//event listener to run code when clicked
buttonElement.addEventListener('click', () => {
    titleElement.textContent = "You clicked the button";
    titleElement.style.color = "#007bff";
});