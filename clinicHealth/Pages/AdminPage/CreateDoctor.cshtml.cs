using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.AdminPage
{
    public class CreateModel : PageModel
    {
        public Users user = new Users();
        public String errorMessage = "";
        public String successMessage = "";
        public void OnGet()
        {
        }
        public void OnPost()
        { user.username = Request.Form["username"] ;
             user.password = Request.Form["password"] ;
            user.full_name = Request.Form["name"];
            user.Gender = Request.Form["gender"];
            user.age =  Convert.ToInt32(Request.Form["Age"]);
            if(user.username.Length == 0 || user.password.Length == 0 || user.full_name.Length == 0  ||user.Gender.Length == 0 ||user.age.ToString().Length == 0)
                {
                errorMessage = "All Fields are Required";
                return;

            }
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String query = "INSERT INTO users" +
                                   "(full_name,username,age,Gender,role_id,password) VALUES " +
                                   "(@full_name,@username,@Age,@Gender,2,@password);";
                    using(SqlCommand command = new SqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@full_name", user.full_name);
                        command.Parameters.AddWithValue("@Age", user.age);
                        command.Parameters.AddWithValue("@Gender", user.Gender);
                        command.Parameters.AddWithValue("@username", user.username);
                        command.Parameters.AddWithValue("@password", user.password);
                        command.ExecuteNonQuery();
                    }
                }

            }
            catch(Exception ex) {
                errorMessage = ex.Message;
                return;

                 }
            user.full_name = "";user.Gender = "";user.age = 0;
            successMessage = "New Docotr has Been Added!";
            Response.Redirect("/AdminPage/doctors");
        }
    }
}
